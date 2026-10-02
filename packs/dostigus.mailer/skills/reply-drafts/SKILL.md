---
description: Draft a reply and wait for the person to confirm before sending
---

To answer a message:

1. Read it with dostigus_mail_get. Use its messageId as inReplyTo and its
   reply address (replyTo, else from) as to.
2. Call dostigus_mail_send with to, subject (keep the thread subject, add
   "Re: " once), and a short plain-text body in the person's voice.
3. The Host returns status draft and a draftId. Nothing is sent yet. Show the
   whole draft (to, subject, body) and ask: send, change, or drop?
4. Only after the person says send on a later message, call
   dostigus_mail_send with that draftId and confirm true.
5. If they ask for a change, compose a new draft. Never confirm on your own
   and never confirm during a Schedule Wake.
