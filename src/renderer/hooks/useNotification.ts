import { useToast } from '@/components/ui/use-toast';

/**
 * Notification hook that wraps shadcn/ui toast with semantic variants
 * Provides helper methods for success, error, info, and warning notifications
 */
export function useNotification() {
  const { toast } = useToast();

  const success = (title: string, description?: string) => {
    toast({
      title,
      description,
      variant: 'default',
      className: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100',
    });
  };

  const error = (title: string, description?: string) => {
    toast({
      title,
      description,
      variant: 'destructive',
    });
  };

  const info = (title: string, description?: string) => {
    toast({
      title,
      description,
      variant: 'default',
    });
  };

  const warning = (title: string, description?: string) => {
    toast({
      title,
      description,
      variant: 'default',
      className: 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-100',
    });
  };

  return {
    success,
    error,
    info,
    warning,
  };
}
