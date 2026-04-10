/**
 * Toast utility — wraps sonner so the rest of the app has a consistent import.
 *
 * Usage (same in every component):
 *   import { toast } from '@/lib/toast';
 *   toast.success('Saved!');
 *   toast.error('Something went wrong');
 *   toast('Plain message');
 */
export { toast } from 'sonner';
