"use client";

import {
  iconProps,
  SectionMenuButton,
  SectionSidebar,
  type NavSection,
} from "@/components/ui/section-nav";

const sections: NavSection[] = [
  {
    href: "/settings/notifications",
    label: "Notifications",
    hint: "Reminders & alerts",
    icon: (
      <svg {...iconProps}>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    href: "/settings/profile",
    label: "Profile",
    hint: "You, photo, body",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
  {
    href: "/settings/appearance",
    label: "Appearance",
    hint: "Light or dark, background",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/settings/assistant",
    label: "Assistant",
    hint: "Name, memory",
    icon: (
      <svg {...iconProps}>
        <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
        <path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z" />
      </svg>
    ),
  },
  {
    href: "/settings/bank-messages",
    label: "Bank messages",
    hint: "Forward SMS from your phone",
    icon: (
      <svg {...iconProps}>
        <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    ),
  },
  {
    href: "/settings/integrations",
    label: "Integrations",
    hint: "Splitwise, Groww",
    icon: (
      <svg {...iconProps}>
        <path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0z" />
        <path d="M12 18v4" />
      </svg>
    ),
  },
  {
    href: "/settings/documents",
    label: "Documents",
    hint: "Your saved files",
    icon: (
      <svg {...iconProps}>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    ),
  },
  {
    href: "/settings/reports",
    label: "Reports",
    hint: "Download PDFs",
    icon: (
      <svg {...iconProps}>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6M12 12v6M9 15l3 3 3-3" />
      </svg>
    ),
  },
];

export function SettingsSidebar() {
  return <SectionSidebar sections={sections} label="Settings sections" />;
}

export function SettingsMenuButton() {
  return (
    <SectionMenuButton sections={sections} label="Settings sections" title="Settings" />
  );
}
