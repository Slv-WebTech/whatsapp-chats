import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { authenticate } from '../_lib/rbac.js';
import { getFirebaseAdminApp } from '../_lib/firebaseAdmin.js';

function dedupe(ids = []) {
    return Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    const user = await authenticate(req, res);
    if (!user) {
        return;
    }

    try {
        const app = getFirebaseAdminApp();
        const adminDb = getFirestore(app);
        const uid = String(user.uid || '').trim();

        const [memberChatsSnapshot, ownerChatsSnapshot, creatorChatsSnapshot] = await Promise.all([
            adminDb.collection('chats').where('members', 'array-contains', uid).limit(500).get(),
            adminDb.collection('chats').where('ownerId', '==', uid).limit(500).get(),
            adminDb.collection('chats').where('createdBy', '==', uid).limit(500).get()
        ]);

        const memberIds = memberChatsSnapshot.docs.map((doc) => doc.id);
        const ownerIds = ownerChatsSnapshot.docs.map((doc) => doc.id);
        const creatorIds = creatorChatsSnapshot.docs.map((doc) => doc.id);
        const mergedIds = dedupe([...memberIds, ...ownerIds, ...creatorIds]);

        // Repair data drift: ensure owner/creator is always a member in their own chats.
        const repairTargets = dedupe([...ownerIds, ...creatorIds]);
        if (repairTargets.length) {
            const batch = adminDb.batch();
            repairTargets.forEach((chatId) => {
                const chatRef = adminDb.collection('chats').doc(chatId);
                const isOwnerChat = ownerIds.includes(chatId);
                batch.set(
                    chatRef,
                    {
                        members: FieldValue.arrayUnion(uid),
                        ...(isOwnerChat ? { [`memberRoles.${uid}`]: 'owner' } : {}),
                        updatedAt: FieldValue.serverTimestamp()
                    },
                    { merge: true }
                );
            });
            await batch.commit();
        }

        await adminDb
            .collection('user_chats')
            .doc(uid)
            .set(
                {
                    chatIds: mergedIds,
                    updatedAt: FieldValue.serverTimestamp()
                },
                { merge: true }
            );

        return res.status(200).json({
            ok: true,
            uid,
            totalChats: mergedIds.length,
            memberChatCount: memberIds.length,
            ownerChatCount: ownerIds.length,
            creatorChatCount: creatorIds.length,
            repairedOwnerMembershipCount: repairTargets.length
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Failed to resync chat membership.',
            details: String(error?.message || error || 'Unknown error')
        });
    }
}