import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

type StatusVariant = 'default' | 'secondary' | 'destructive' | 'outline';

interface StatusConfig {
  label: string;
  variant: StatusVariant;
  className?: string;
}

const statusConfig: Record<string, StatusConfig> = {
  ACTIVE: {
    label: '활성',
    variant: 'default',
    className: 'bg-green-500 hover:bg-green-500/80',
  },
  PENDING: {
    label: '대기중',
    variant: 'secondary',
    className: 'bg-yellow-500 hover:bg-yellow-500/80 text-white',
  },
  INACTIVE: {
    label: '비활성',
    variant: 'secondary',
    className: 'bg-gray-500 hover:bg-gray-500/80',
  },
  SUSPENDED: {
    label: '중단됨',
    variant: 'destructive',
  },
  DRAFT: {
    label: '초안',
    variant: 'outline',
    className: 'bg-blue-500 hover:bg-blue-500/80 text-white border-blue-500',
  },
  COMPLETED: {
    label: '완료',
    variant: 'default',
    className: 'bg-green-500 hover:bg-green-500/80',
  },
  ARCHIVED: {
    label: '보관',
    variant: 'secondary',
    className: 'bg-gray-500 hover:bg-gray-500/80',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status.toUpperCase()] || {
    label: status,
    variant: 'outline' as StatusVariant,
  };

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}

export function getStatusLabel(status: string): string {
  const config = statusConfig[status.toUpperCase()];
  return config ? config.label : status;
}
