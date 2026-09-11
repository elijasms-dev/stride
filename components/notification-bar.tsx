'use client';

import { useState } from 'react';
import { Bell, ChevronDown, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';

export type AppNotification = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

/** Passive updates stay available without competing with today's workout. */
export function NotificationBar({
  notifications,
}: {
  notifications: AppNotification[];
}) {
  const [open, setOpen] = useState(false);
  if (!notifications.length) return null;

  return (
    <div className="training-notification-bar">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="training-notification-trigger">
          <Bell size={18} aria-hidden="true" />
          <span className="training-notification-label">
            {notifications.length === 1
              ? notifications[0].title
              : `${notifications.length} training notifications`}
          </span>
          <span className="training-notification-hint">Details</span>
          <ChevronDown
            className="training-notification-chevron"
            size={16}
            aria-hidden="true"
          />
        </PopoverTrigger>
        <PopoverContent
          className="training-notification-panel"
          align="end"
          sideOffset={8}
        >
          <div className="training-notification-heading">
            <PopoverTitle>Notifications</PopoverTitle>
            <button
              type="button"
              className="training-notification-close"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <ul className="training-notification-list">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <h3>{notification.title}</h3>
                <p>{notification.description}</p>
                <button
                  type="button"
                  className="training-notification-action"
                  onClick={() => {
                    setOpen(false);
                    notification.onAction();
                  }}
                >
                  {notification.actionLabel}
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
