import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { properties, accounts } from '@/drizzle/schema';
import { eq, desc, count } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin } from 'lucide-react';
import PropertyActions from './PropertyActions';
import CSVImportButton from './CSVImportButton';

export const metadata: Metadata = { title: 'Properties' };

export default async function PropertiesPage() {
  await requireRole('admin');

  const allAccounts = await db
    .select({ id: accounts.id, name: accounts.name })
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
      accountName: accounts.name,
    })
    .from(properties)
    .leftJoin(accounts, eq(properties.accountId, accounts.id))
    .orderBy(accounts.name, properties.name);

  // Group by account
  const byAccount = allAccounts.map(account => ({
    ...account,
    properties: allProperties.filter(p => p.accountId === account.id),
  })).filter(a => a.properties.length > 0 || true); // show all accounts

  const totalProperties = allProperties.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description={`${totalProperties} propert${totalProperties !== 1 ? 'ies' : 'y'} across ${allAccounts.length} account${allAccounts.length !== 1 ? 's' : ''}`}
      >
        <div className="flex items-center gap-2">
          <CSVImportButton accounts={allAccounts} />
          <PropertyActions
            mode="add"
            accounts={allAccounts}
          />
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Properties" value={totalProperties} />
        <StatCard label="Accounts" value={allAccounts.length} />
        <StatCard
          label="Commercial"
          value={allProperties.filter(p => p.buildingType === 'commercial').length}
        />
        <StatCard
          label="Residential"
          value={allProperties.filter(p => p.buildingType === 'residential').length}
        />
      </div>

      {/* Properties by account */}
      <div className="space-y-6">
        {byAccount.map(account => (
          <div key={account.id}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-base">{account.name}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {account.properties.length} propert{account.properties.length !== 1 ? 'ies' : 'y'}
                </span>
                <PropertyActions
                  mode="add"
                  accounts={allAccounts}
                  defaultAccountId={account.id}
                />
              </div>
            </div>

            {account.properties.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No properties yet. Click "Add Property" to add one.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {account.properties.map(prop => (
                  <div key={prop.id} className="rounded-lg border border-border bg-card p-4 space-y-2 hover:shadow-sm transition-shadow">
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
                        accounts={allAccounts}
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
        ))}
      </div>

      {allAccounts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No accounts yet</p>
          <p className="text-sm">Add accounts first, then add properties under them.</p>
        </div>
      )}
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
