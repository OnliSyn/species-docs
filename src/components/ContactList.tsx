'use client';

import { cn } from '@/lib/utils';

interface Contact {
  id: string;
  name: string;
  address: string;
  online: boolean;
  avatarUrl?: string;
}

interface ContactListProps {
  contacts: Contact[];
  onContactTap: (contact: Contact) => void;
  onAddContact: () => void;
}

export function ContactList({ contacts, onContactTap, onAddContact }: ContactListProps) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          Contacts
        </h3>
        <button
          onClick={onAddContact}
          className="w-6 h-6 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm flex items-center justify-center hover:bg-[var(--color-accent-green)]"
        >
          +
        </button>
      </div>

      <div className="space-y-2">
        {contacts.map((contact) => (
          <button
            key={contact.id}
            onClick={() => onContactTap(contact)}
            className="w-full flex items-center gap-3 p-2 rounded-[var(--radius-input)] hover:bg-[var(--color-bg-card)] transition-colors"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-[var(--color-bg-sidebar)] border border-[var(--color-border)]" />
              <div
                className={cn(
                  'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white',
                  contact.online ? 'bg-[var(--color-accent-green)]' : 'bg-[var(--color-text-secondary)]'
                )}
              />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{contact.name}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {contact.address.slice(0, 6)}...{contact.address.slice(-4)}
              </p>
            </div>
            <span className="text-xs text-[var(--color-text-secondary)]">
              Transfer
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
