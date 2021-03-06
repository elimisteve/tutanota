"use strict";

tutao.provide('tutao.tutanota.ctrl.SendUnsecureMailFacade');

/**
 * Sends a mail to tutanota and external recipients.
 * @param {string} subject The subject of the mail.
 * @param {string} bodyText The bodyText of the mail.
 * @param {string} senderMailAddress The senders mail address.
 * @param {string} senderName The name of the sender that is sent together with the mail address of the sender.
 * @param {Array.<tutao.tutanota.ctrl.RecipientInfo>} toRecipients The recipients the mail shall be sent to.
 * @param {Array.<tutao.tutanota.ctrl.RecipientInfo>} ccRecipients The recipients the mail shall be sent to in cc.
 * @param {Array.<tutao.tutanota.ctrl.RecipientInfo>} bccRecipients The recipients the mail shall be sent to in bcc.
 * @param {string} conversationType See TutanotaConstants.
 * @param {string} previousMessageId The id of the message that this mail is a reply or forward to. Empty string if this is a new mail.
 * @param {Array.<tutao.tutanota.util.DataFile|tutao.entity.tutanota.File|tutao.native.AndroidFile>} attachments The new files that shall be attached to this mail.
 * @param {string} language Notification mail language.
 * @return {Promise.<string, tutao.RecipientsNotFoundError|tutao.TooManyRequestsError|tutao.AccessBlockedError>} Resolved finished with the id of the senders mail (only element id, no list id). Rejected with a
 * RecipientsNotFoundError if some of the recipients could not be found, rejected with TooManyRequestsError if the number allowed mails was exceeded, AccessBlockedError if the customer is not allowed to send emails currently because he is marked for approval.
 */
tutao.tutanota.ctrl.SendUnsecureMailFacade.sendMail = function(subject, bodyText, senderMailAddress, senderName, toRecipients, ccRecipients, bccRecipients, conversationType, previousMessageId, attachments, language) {
	var aes = tutao.locator.aesCrypter;
	var groupKey = tutao.locator.userController.getUserGroupKey();
	var sharableKey = tutao.locator.mailBoxController.getUserMailBoxBucketData().getBucketKey();
	var mailBoxKey = tutao.locator.mailBoxController.getUserMailBox()._entityHelper.getSessionKey();
	var sessionKey = tutao.locator.aesCrypter.generateRandomKey();

	var service = new tutao.entity.tutanota.SendUnsecureMailData();
    service.setLanguage(language)
	    .setSubject(subject)
	    .setBodyText(bodyText)
        .setSenderMailAddress(senderMailAddress)
	    .setSenderName(senderName)
	    .setConversationType(conversationType)
	    .setPreviousMessageId(previousMessageId)
	    .setMailSessionKey(tutao.util.EncodingConverter.keyToBase64(sessionKey)) // for recipients
	    .setListEncSessionKey(aes.encryptKey(mailBoxKey, sessionKey)) // for sender
	    .setSymEncSessionKey(aes.encryptKey(groupKey, sessionKey)) // for sender
	    .setSharableEncSessionKey(aes.encryptKey(sharableKey, sessionKey)); // for sharing the mailbox

    return Promise.each(attachments, function(dataFile, index, number) {
        var attachment = new tutao.entity.tutanota.UnsecureAttachment(service);
        return tutao.tutanota.ctrl.SendMailFacade.createAttachment(attachment, dataFile).then(function(fileSessionKey) {
            attachment.setFileSessionKey(tutao.util.EncodingConverter.keyToBase64(fileSessionKey))
                .setListEncFileSessionKey(aes.encryptKey(mailBoxKey, fileSessionKey));

            service.getAttachments().push(attachment);
        });
    }).then(function() {
        for (var i = 0; i < toRecipients.length; i++) {
            var recipient = new tutao.entity.tutanota.UnsecureRecipient(service);
            recipient.setName(toRecipients[i].getName());
            recipient.setMailAddress(toRecipients[i].getMailAddress());
            service.getToRecipients().push(recipient);
        }
        for (var i = 0; i < ccRecipients.length; i++) {
            var recipient = new tutao.entity.tutanota.UnsecureRecipient(service);
            recipient.setName(ccRecipients[i].getName());
            recipient.setMailAddress(ccRecipients[i].getMailAddress());
            service.getCcRecipients().push(recipient);
        }
        for (var i = 0; i < bccRecipients.length; i++) {
            var recipient = new tutao.entity.tutanota.UnsecureRecipient(service);
            recipient.setName(bccRecipients[i].getName());
            recipient.setMailAddress(bccRecipients[i].getMailAddress());
            service.getBccRecipients().push(recipient);
        }
        var map = {};
        return service.setup(map, tutao.entity.EntityHelper.createAuthHeaders()).then(function(sendUnsecureMailReturn) {
            var mailElementId = sendUnsecureMailReturn.getSenderMail()[1];
            return mailElementId;
        });
    });
};