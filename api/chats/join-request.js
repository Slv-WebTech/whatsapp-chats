import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { authenticate } from '../_lib/rbac.js';
import { getFirebaseAdminApp } from '../_lib/firebaseAdmin.js';

function isModeratorForChat(chatData, uid, role) {
    if (!chatData || !uid) {
        return false;
    }

    if (role === 'admin') {
        return true;
    }

    const ownerId = String(chatData.ownerId || chatData.createdBy || '').trim();
    if (ownerId && ownerId === uid) {
        return true;
    }

    const memberRoles = chatData.memberRoles && typeof chatData.memberRoles === 'object' ? chatData.memberRoles : {};
    const actorRole = String(memberRoles[uid] || '').toLowerCase();
    return actorRole === 'owner' || actorRole === 'admin';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    const user = await authenticate(req, res);
    if (!user) {
        return;
    }

    const safeChatId = String(req.body?.chatId || '').trim();
    const safeRequestId = String(req.body?.requestId || '').trim();
    const action = String(req.body?.action || '').trim().toLowerCase();

    if (!safeChatId || !safeRequestId) {
        return res.status(400).json({ error: 'chatId and requestId are required.' });
    }

    if (action !== 'approve' && action !== 'reject') {
        return res.status(400).json({ error: 'action must be approve or reject.' });
    }

    try {
        const app = getFirebaseAdminApp();
        const adminDb = getFirestore(app);

        const chatRef = adminDb.collection('chats').doc(safeChatId);
        const chatSnapshot = await chatRef.get();
        if (!chatSnapshot.exists) {
            return res.status(404).json({ error: 'Chat not found.' });
        }

        const chatData = chatSnapshot.data() || {};
        if (!isModeratorForChat(chatData, user.uid, user.role)) {
            return res.status(403).json({ error: 'Only group owner/admin can moderate requests.' });
        }

        const requestRef = adminDb.collection('chats').doc(safeChatId).collection('join_requests').doc(safeRequestId);
        const requestSnapshot = await requestRef.get();
        if (!requestSnapshot.exists) {
            return res.status(404).json({ error: 'Join request not found.' });
        }

        const requestData = requestSnapshot.data() || {};
        const targetUid = String(requestData.uid || safeRequestId).trim();
        const username = String(requestData.username || 'Member').trim() || 'Member';

        if (!targetUid) {
            return res.status(400).json({ error: 'Invalid request user id.' });
        }

        if (action === 'reject') {
            await requestRef.delete();
            return res.status(200).json({ ok: true, action: 'reject', chatId: safeChatId, requestId: safeRequestId });
        }

        const batch = adminDb.batch();
        batch.set(
            chatRef,
            {
                members: FieldValue.arrayUnion(targetUid),
                [`memberUsernames.${targetUid}`]: username,
                updatedAt: FieldValue.serverTimestamp()
            },
            { merge: true }
        );
        batch.set(
            adminDb.collection('user_chats').doc(targetUid),
            {
                chatIds: FieldValue.arrayUnion(safeChatId),
                updatedAt: FieldValue.serverTimestamp()
            },
            { merge: true }
        );
        batch.delete(requestRef);
        await batch.commit();

        return res.status(200).json({
            ok: true,
            action: 'approve',
            chatId: safeChatId,
            requestId: safeRequestId,
            memberUid: targetUid
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Failed to process join request.',
            details: String(error?.message || error || 'Unknown error')
        });
    }
}
