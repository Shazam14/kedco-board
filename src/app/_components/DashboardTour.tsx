'use client';

import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_KEY = 'kedco_dashboard_tour_done';

const steps = [
  {
    popover: {
      title: 'Welcome to the Kedco FX Dashboard',
      description: 'This is your live command center — capital position, transactions, riders, and rates all in one place. Let\'s do a quick tour.',
    },
  },
  {
    element: '[data-tour="nav-tabs"]',
    popover: {
      title: 'Your 6 Sections',
      description: '<strong>Dashboard</strong> — overview &amp; capital<br><strong>Positions</strong> — all currency stocks<br><strong>Transactions</strong> — full transaction log<br><strong>Rider</strong> — dispatch &amp; track riders<br><strong>Rate Board</strong> — published FX rates<br><strong>Tracker</strong> — check payments &amp; bank passbook',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="capital-hero"]',
    popover: {
      title: 'Total Capital Position',
      description: 'Your total capital in PHP equivalent — FX stock value + PHP cash on hand. Updates in real time as transactions come in.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="than-card"]',
    popover: {
      title: 'Today\'s THAN (Profit Margin)',
      description: 'THAN = (sell rate − daily average cost) × units sold. This is your combined profit from the counter and all riders today.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="recent-txns"]',
    popover: {
      title: 'Recent Transactions',
      description: 'Live feed of today\'s counter and rider transactions. Switch to the <strong>Transactions</strong> tab for filters, OR/ref numbers, and the full list.',
      side: 'top' as const,
    },
  },
  {
    element: '[data-tour="ticker"]',
    popover: {
      title: 'Live Rate Ticker',
      description: 'Today\'s buy and sell rates for all active currencies, scrolling in real time.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="admin-btn"]',
    popover: {
      title: 'Admin Panel',
      description: 'Click here to access admin-only tools — set rates, manage users, run end of day, view reports, and more.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="btn-dashboard-tour"]',
    popover: {
      title: 'You\'re all set!',
      description: 'Click <strong>? Tour</strong> anytime to replay this walkthrough.',
      side: 'bottom' as const,
    },
  },
];

function startTour() {
  const driverObj = driver({
    showProgress: true,
    progressText: '{{current}} of {{total}}',
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    doneBtnText: 'Done',
    overlayOpacity: 0.6,
    smoothScroll: true,
    steps,
    onDestroyed: () => {
      localStorage.setItem(TOUR_KEY, '1');
    },
  });
  driverObj.drive();
}

export function DashboardTourButton({ style }: { style?: React.CSSProperties }) {
  return (
    <button
      data-tour="btn-dashboard-tour"
      onClick={startTour}
      style={{
        padding: '4px 12px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--muted)',
        fontFamily: "'DM Mono',monospace",
        fontSize: 10,
        cursor: 'pointer',
        letterSpacing: '0.05em',
        ...style,
      }}
    >
      ? TOUR
    </button>
  );
}

export function DashboardTourAutoStart() {
  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      setTimeout(startTour, 800);
    }
  }, []);
  return null;
}
