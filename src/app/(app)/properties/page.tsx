import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { properties, accounts } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin } from 'lucide-react';
import PropertyActions from './PropertyActions';
import AccountActions from './AccountActions';
import CSVImportButton from './CSVImportButton';

export const metadata: Metadata = { title: 'Properties' };

export default async function PropertiesPage() {
  await requireRole('admin');

  const allAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      email: accounts.email,
      phone: accounts.phone,
      address: accounts.address,
      city: accounts.city,
      state: accounts.state,
      zip: accounts.zip,
    })
    .from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(accounts.name);

  const allProperties = await db
    .select({
      id: properties.id,
      name: properties.name,
      address: properties.address,
      city: properties.city,
      state: properties.state,
      zip: properties.zip,
      buildingType: properties.buildingType,
      elevatorCount: properties.elevatorCount,
      accountId: properties.accountId,
    })
    .from(properties)
    .orderBy(properties.name);

  const totalProperties = allProperties.length;
  const accountsForProps = allAccounts.map(a => ({ id: a.id, name: a.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts & Properties"
        description={`${allAccounts.length} account${allAccounts.length !== 1 ? 's' : ''} · ${totalProperties} propert${totalProperties !== 1 ? 'ies' : 'y'}`}
      >
        {/* Top-right: only account-level actions + CSV import */}
        <div className="flex items-center gap-2">
          <CSVImportButton accounts={accountsForProps} />
          <AccountActions mode="add" />
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Accounts" value={allAccounts.length} />
        <StatCard label="Total Properties" value={totalProperties} />
        <StatCard label="Commercial" value={allProperties.filter(p => p.buildingType === 'commercial').length} />
        <StatCard label="Residential" value={allProperties.filter(p => p.buildingType === 'residential').length} />
      </div>

      {/* Accounts with no properties prompt */}
      {allAccounts.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center space-y-3">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
          <p className="font-medium text-muted-foreground">No accounts yet</p>
          <p className="text-sm text-muted-foreground">
            Create an account first (e.g. "Westside Properties LLC"), then add properties under it.
          </p>
          <AccountActions mode="add" />
        </div>
      )}

      {/* Properties grouped by account */}
      <div className="space-y-8">
        {allAccounts.map(account => {
          const accountProperties = allProperties.filter(p => p.accountId === account.id);
          return (
            <div key={account.id} className="space-y-3">
              {/* Account header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-base">{account.name}</h2>
                      <AccountActions mode="edit" account={account} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {account.email && <span>{account.email}</span>}
                      {account.phone && <span>{account.phone}</span>}
                      {account.city && <span>{account.city}, {account.state}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {accountProperties.length} propert{accountProperties.length !== 1 ? 'ies' : 'y'}
                  </span>
                  {/* Per-account Add Property button */}
                  <PropertyActions
                    mode="add"
                    accounts={accountsForProps}
                    defaultAccountId={account.id}
                  />
                </div>
              </div>

              {/* Properties grid */}
              {accountProperties.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No properties yet for this account.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {accountProperties.map(prop => (
                    <div
                      key={prop.id}
                      className="rounded-lg border border-border bg-card p-4 space-y-2 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{prop.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{prop.address}, {prop.city}</span>
                          </p>
                        </div>
                        <PropertyActions
                          mode="edit"
                          accounts={accountsForProps}
                          property={prop}
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs capitalize">
                          <Building2 className="h-3 w-3 mr-1" />
                          {prop.buildingType?.replace('_', ' ') ?? 'Unknown'}
                        </Badge>
                        {prop.elevatorCount && prop.elevatorCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {prop.elevatorCount} elevator{prop.elevatorCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {prop.zip && (
                          <span className="text-xs text-muted-foreground">{prop.zip}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
