'use client';

import { BalanceView } from '@/components/BalanceView';
import { AssuranceCard } from '@/components/AssuranceCard';
import { ContactList } from '@/components/ContactList';
import { FundWizard } from './FundWizard';
import { CirculationCard } from './CirculationCard';
import { useVirtualAccounts, useAssetBalance } from '@/hooks/use-virtual-accounts';
import { MOCK_USER_ID, MOCK_SPECIES_VA_ID } from '@/lib/mock-data';

const MOCK_CONTACTS = [
  { id: '1', name: 'Pepper Potts', address: '0x1234...5678abcd', online: true },
  { id: '2', name: 'Tony Stark', address: '0xabcd...1234ef56', online: false },
  { id: '3', name: 'Happy Hogan', address: '0x5678...abcd1234', online: true },
];

const TOTAL_CIRCULATION = 1_000_000;

export function AccountPanel() {
  const { data: accounts } = useVirtualAccounts(MOCK_USER_ID);

  const fundingVA = accounts?.find((a) => a.subtype === 'funding');
  const assuranceVA = accounts?.find((a) => a.subtype === 'assurance');

  const fundingBalance = fundingVA?.balance?.posted_balance
    ? BigInt(fundingVA.balance.posted_balance)
    : 0n;

  const assuranceBalance = assuranceVA?.balance?.posted_balance
    ? BigInt(assuranceVA.balance.posted_balance)
    : 0n;

  const { financialBalance: assetBalance, possessionCount: specieCount, isReconciled } =
    useAssetBalance(MOCK_SPECIES_VA_ID, MOCK_USER_ID);

  return (
    <div className="space-y-4">
      <FundWizard />
      <BalanceView
        fundingBalance={fundingBalance}
        assetBalance={assetBalance}
        specieCount={specieCount}
        isReconciled={isReconciled}
      />
      <CirculationCard totalCirculation={TOTAL_CIRCULATION} />
      <AssuranceCard
        assuranceBalance={assuranceBalance}
        totalOutstanding={BigInt(TOTAL_CIRCULATION) * 1_000_000n}
      />
      <ContactList
        contacts={MOCK_CONTACTS}
        onContactTap={(c) => console.log('Transfer to:', c.name)}
        onAddContact={() => console.log('Add contact')}
      />
    </div>
  );
}
