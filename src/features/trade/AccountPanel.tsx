'use client';

import { BalanceView } from '@/components/BalanceView';
import { AssuranceCard } from '@/components/AssuranceCard';
import { ContactList } from '@/components/ContactList';
import { FundWizard } from './FundWizard';
import { CirculationCard } from './CirculationCard';
import { useTradePanelTruth } from '@/hooks/use-virtual-accounts';

/** Matches MarketSB / species-sim seed user (see verify-balances route). */
const USER_REF = 'user-001';

const MOCK_CONTACTS = [
  { id: '1', name: 'Pepper Potts', address: '0x1234...5678abcd', online: true },
  { id: '2', name: 'Tony Stark', address: '0xabcd...1234ef56', online: false },
  { id: '3', name: 'Happy Hogan', address: '0x5678...abcd1234', online: true },
];

export function AccountPanel() {
  const { data: truth, isLoading, error } = useTradePanelTruth(USER_REF);

  return (
    <div className="space-y-4">
      <FundWizard />
      {isLoading && (
        <p className="text-xs text-[var(--color-text-secondary)]">Loading portfolio…</p>
      )}
      {error && (
        <p className="text-xs text-[var(--color-accent-red)]">
          Could not load portfolio: {(error as Error).message}
        </p>
      )}
      {truth && (
        <>
          <div
            className="sr-only"
            aria-hidden
            data-testid="trade-panel-truth"
            data-funding-posted={truth.fundingPosted}
            data-vault-count={String(truth.vaultSpecieCount)}
            data-species-va-posted={truth.speciesVaPosted}
            data-assurance-posted={truth.assuranceGlobalPosted}
            data-circulation-value-posted={truth.circulationValuePosted}
            data-coverage-percent={String(truth.coveragePercent)}
          />
          <BalanceView
            fundingPostedDisplay={truth.fundingPostedDisplay}
            speciesVaPostedDisplay={truth.speciesVaPostedDisplay}
            vaultSpecieCount={truth.vaultSpecieCount}
          />
          <CirculationCard
            totalCirculation={truth.circulationSpecieCount}
            circulationValuePostedDisplay={truth.circulationValuePostedDisplay}
          />
          <AssuranceCard
            assurancePostedDisplay={truth.assuranceGlobalPostedDisplay}
            circulationValuePostedDisplay={truth.circulationValuePostedDisplay}
            circulationSpecieCount={truth.circulationSpecieCount}
            buyBackGuaranteeDollars={truth.buyBackGuaranteeDollars}
            buyBackGuaranteeCents={truth.buyBackGuaranteeCents}
            coveragePercent={truth.coveragePercent}
          />
        </>
      )}
      <ContactList
        contacts={MOCK_CONTACTS}
        onContactTap={(c) => console.log('Transfer to:', c.name)}
        onAddContact={() => console.log('Add contact')}
      />
    </div>
  );
}
