"use client";

import {
  iconProps,
  SectionMenuButton,
  SectionSidebar,
  type NavSection,
} from "@/components/ui/section-nav";

const sections: NavSection[] = [
  {
    href: "/financial/daily",
    label: "Daily",
    hint: "Today's entries",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    href: "/financial/monthly",
    label: "Monthly",
    hint: "Plan vs actual",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    href: "/financial/yearly",
    label: "Yearly",
    hint: "The whole year",
    icon: (
      <svg {...iconProps}>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
      </svg>
    ),
  },
  {
    href: "/financial/borrow",
    label: "Borrow",
    hint: "Money owed",
    icon: (
      <svg {...iconProps}>
        <path d="M7 10l-4 4 4 4" />
        <path d="M3 14h13" />
        <path d="M17 14l4-4-4-4" />
        <path d="M21 10H8" />
      </svg>
    ),
  },
  {
    href: "/financial/savings",
    label: "Savings",
    hint: "Accounts & investments",
    icon: (
      <svg {...iconProps}>
        <path d="M19 7h-1.5A6 6 0 0 0 7 5.5 6.5 6.5 0 0 0 5 17v3h3v-2h6v2h3v-3.5a5 5 0 0 0 2-2.5h2v-4h-2a5 5 0 0 0 0-3z" />
        <circle cx="15.5" cy="10.5" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/financial/emi",
    label: "EMI",
    hint: "Loans & installments",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h2M12 15h5" />
      </svg>
    ),
  },
  {
    href: "/financial/tracking",
    label: "Tracking",
    hint: "Trends & charts",
    icon: (
      <svg {...iconProps}>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
];

export function FinanceSidebar() {
  return <SectionSidebar sections={sections} label="Finance sections" />;
}

export function FinanceMenuButton() {
  return (
    <SectionMenuButton sections={sections} label="Finance sections" title="Finance" />
  );
}
