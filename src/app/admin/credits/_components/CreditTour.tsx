'use client';

import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_KEY = 'kedco_credits_tour_done';

const steps = [
  {
    popover: {
      title: 'Special Customer Credits',
      description: 'This quick tour walks you through how to create and manage credit extended to special customers. Replay anytime via the <strong>? Tour</strong> button.',
    },
  },
  {
    element: '[data-tour="credits-summary"]',
    popover: {
      title: 'At a Glance',
      description: 'Four live totals across all credits — capital currently out, total interest (THAN) earned, total repaid, and what\'s still outstanding.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="btn-new-credit"]',
    popover: {
      title: 'Create a Credit',
      description: 'Click <strong>+ New Credit</strong> to open the form.<br><br><strong>Option A (Upfront):</strong> Interest is collected upfront — customer receives principal minus interest and pays back the full amount.<br><br><strong>Option B (Installment):</strong> Total due is split into equal payments with individual due dates. Overdue installments turn red automatically.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="btn-rules"]',
    popover: {
      title: 'Draw Rules',
      description: 'Set limits on how often and how much can be drawn on a single credit — minimum interval between draws, max draws per day, and max amount per draw.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="credits-filter"]',
    popover: {
      title: 'Filter Credits',
      description: 'Switch between <strong>ACTIVE</strong> (currently running), <strong>COMPLETED</strong> (all paid), <strong>CANCELLED</strong>, or <strong>ALL</strong> to see the full history.',
      side: 'bottom' as const,
    },
  },
  {
    element: '[data-tour="credits-list"]',
    popover: {
      title: 'Credit List',
      description: 'Click any row to expand it and see the full payment schedule. Overdue credits show a red border. Use <strong>Mark Paid</strong> when a payment arrives, or <strong>+ Add Draw</strong> for an additional borrow.',
      side: 'top' as const,
    },
  },
  {
    element: '[data-tour="btn-credit-tour"]',
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

export function CreditTourButton() {
  return (
    <button
      data-tour="btn-credit-tour"
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

export function CreditTourAutoStart() {
  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      setTimeout(startTour, 600);
    }
  }, []);

  return null;
}
