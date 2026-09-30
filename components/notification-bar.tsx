'use client';

import { useRef, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
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

/** Training updates have a permanent home beside the profile, without displacing the plan. */
export function NotificationBar({
  notifications,
}: {
  notifications: AppNotification[];
}) {
  const [open, setOpen] = useState(false);
  const handingOffFocus = useRef(false);
  const count = notifications.length;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) handingOffFocus.current = false;
        setOpen(next);
      }}
    >
      <PopoverTrigger
        className="training-notification-bell"
        aria-label={
          count
            ? `Notifications, ${count} training ${count === 1 ? 'update' : 'updates'}`
            : 'Notifications, no new updates'
        }
      >
        <Bell size={20} aria-hidden="true" />
        {count > 0 && (
          <span
            className="training-notification-indicator"
            aria-hidden="true"
          />
        )}
      </PopoverTrigger>
      <PopoverContent
        className="training-notification-panel"
        align="end"
        sideOffset={10}
        finalFocus={() => !handingOffFocus.current}
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
        {count ? (
          <ul className="training-notification-list">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <h3>{notification.title}</h3>
                <p>{notification.description}</p>
                <button
                  type="button"
                  className="training-notification-action"
                  onClick={() => {
                    // The review dialog owns focus once opened; closing this popover must
                    // not pull keyboard users back out to its bell during that handoff.
                    handingOffFocus.current = true;
                    setOpen(false);
                    notification.onAction();
                  }}
                >
                  {notification.actionLabel}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="training-notification-empty">
            <Check size={22} aria-hidden="true" />
            <strong>You’re up to date</strong>
            <p>Training updates will appear here.</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
