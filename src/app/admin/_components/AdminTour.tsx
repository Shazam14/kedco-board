'use client';

import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_KEY = 'kedco_admin_tour_done';

const steps = [
  {
    popover: {
      title: 'Welcome to the Admin Panel',
      description: 'This quick tour walks you through the key tools. You can replay it anytime by clicking the <strong>? Tour</strong> button.',
    },
  },
  {
    element: '[data-tour="card-rates"]',
    popover: {
      title: 'Set Today\'s Rates',
      description: 'Start your day here — enter buy and sell rates for all currencies before the counter opens.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="card-positions"]',
    popover: {
      title: 'Opening Positions',
      description: 'Only needed on Day 1. After that, carry-in stock is calculated automatically from the previous day\'s closing average.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="card-counter"]',
    popover: {
      title: 'Counter',
      description: 'Where cashiers record buy and sell transactions for walk-in customers throughout the day.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="card-report"]',
    popover: {
      title: 'Daily Report',
      description: 'Full breakdown of the day — THAN (profit per unit), positions, and totals by currency and cashier. Replaces the 6 manual books.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="card-eod"]',
    popover: {
      title: 'End of Day',
      description: 'Close the day when done. This locks rates, resets positions, and prepares the carry-in for tomorrow.',
      side: 'top' as const,
    },
  },
  {
    element: '[data-tour="card-audit"]',
    popover: {
      title: 'Audit Trail',
      description: 'Every create, edit, and delete is logged here — who changed what and when.',
      side: 'top' as const,
    },
  },
  {
    element: '[data-tour="card-edit-requests"]',
    popover: {
      title: 'Edit Requests',
      description: 'Cashiers can flag transactions for correction. Review and approve them here.',
      side: 'top' as const,
    },
  },
  {
    element: '[data-tour="btn-tour"]',
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

export function AdminTourButton() {
  return (
    <button
      data-tour="btn-tour"
      onClick={startTour}
      style={{
        padding: '6px 16px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--muted)',
        fontFamily: "'DM Mono',monospace",
        fontSize: 11,
        cursor: 'pointer',
      }}
    >
      ? Tour
    </button>
  );
}

export function AdminTourAutoStart() {
  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      setTimeout(startTour, 600);
    }
  }, []);

  return null;
}
