import type { CallDescription } from '../../interviews/models/interview';

/** Native WebRTC returns class instances; Firestore requires plain objects. */
export function fileDescription(
  value: CallDescription | null,
  type: 'offer' | 'answer',
): CallDescription {
  if (
    !value ||
    value.type !== type ||
    typeof value.sdp !== 'string' ||
    !value.sdp.length ||
    value.sdp.length > 100000
  )
    throw Error('Could not transfer the file. Please try again.');
  return { type, sdp: value.sdp };
}

const userMessages = new Set([
  'Choose a file up to 100 MB.',
  'The file relay is unavailable. Please try again later.',
  'File invitation is no longer available.',
  'File sharing is unavailable on this device.',
  'Choose a private chat to send a file directly.',
  'Please sign in again.',
]);

/** Never display database paths, native exceptions, or provider internals in chat. */
export function fileTransferError(error: unknown): string {
  if (error instanceof Error && userMessages.has(error.message)) return error.message;
  return 'Could not transfer the file. Please try again.';
}
