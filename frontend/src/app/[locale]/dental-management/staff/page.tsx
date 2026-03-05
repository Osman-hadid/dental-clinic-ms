'use client';

import { JSX, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { EntityListClient as EntityList } from '@/components/shared/entity/entity-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { staffConfig } from '@/modules/dental-management/presentation/config/staff-config';
import {
  useCreateStaff,
  useDeleteStaff,
  useStaffList,
  useUpdateStaff,
} from '@/modules/dental-management/presentation/hooks';
import { CalendarDays, ChevronRight, Search, UsersRound } from 'lucide-react';

const TABLE_PER_PAGE = 100;

// eslint-disable-next-line react/function-component-definition
export default function StaffPage(): JSX.Element {
  const t = useTranslations('staff');
  const tSidebar = useTranslations('sidebar.dentalManagement');
  const locale = useLocale();
  const router = useRouter();
  const searchParameters = useSearchParams();

  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);
  const [isPreparingList, setIsPreparingList] = useState(false);

  const trimmedSearch = search.trim();
  const searchFields = useMemo(
    () =>
      staffConfig.searchFields?.map((field) => field.value) ?? [
        'fullName',
        'specialization',
        'contactNumber',
        'email',
      ],
    []
  );

  const { entities: searchResults, isFetching: isSearching } = useStaffList(
    1,
    12,
    trimmedSearch,
    searchFields,
    [],
    {}
  );

  const { entities: dashboardStaff } = useStaffList(1, TABLE_PER_PAGE, '', searchFields, [], {});

  const activeStaff = useMemo(
    () => dashboardStaff.filter((staff) => String(staff.enabled) === '1').length,
    [dashboardStaff]
  );

  const dentistCount = useMemo(
    () =>
      dashboardStaff.filter(
        (staff) =>
          String(staff.role ?? '')
            .toLowerCase()
            .trim() === 'dentist'
      ).length,
    [dashboardStaff]
  );

  const handleOpenStaffDashboard = (staffId: string | number): void => {
    const encodedStaffId = encodeURIComponent(String(staffId));
    router.push(`/${locale}/dental-management/staff/staff-dashboard?staffId=${encodedStaffId}`);
  };

  const isTableQueryReset = useMemo(() => {
    if (searchParameters.get('page') !== '1') return false;
    if (searchParameters.get('perPage') !== String(TABLE_PER_PAGE)) return false;
    if (searchParameters.get('search')) return false;

    for (const key of searchParameters.keys()) {
      if (
        key.startsWith('searchFields[') ||
        key.startsWith('filter[') ||
        key.startsWith('include[')
      ) {
        return false;
      }
    }

    return true;
  }, [searchParameters]);

  useEffect(() => {
    if (!isPreparingList) return;
    if (!isTableQueryReset) return;

    setShowList(true);
    setIsPreparingList(false);
  }, [isPreparingList, isTableQueryReset]);

  const handleToggleList = (): void => {
    if (showList) {
      setShowList(false);
      setIsPreparingList(false);
      return;
    }

    if (isPreparingList) return;

    // Reset table query state so "All staff table" is not accidentally filtered.
    setIsPreparingList(true);
    router.replace(`?page=1&perPage=${TABLE_PER_PAGE}`, { scroll: false });
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'staff', isCurrent: true, label: t(staffConfig.title) },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <section className="rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Dental Dashboard
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">Staff Finder</h2>
                  <p className="text-sm text-muted-foreground">
                    Search quickly, open dashboard, and move directly to staffing insights.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground">
                    <UsersRound className="me-1.5 size-3.5" />
                    Total: {dashboardStaff.length}
                  </Badge>
                  <Badge className="border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground">
                    Active: {activeStaff}
                  </Badge>
                  <Badge className="border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground">
                    Dentists: {dentistCount}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                    }}
                    placeholder="Search staff by name, role, phone..."
                    className="h-11 border-input bg-background pl-10 text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleToggleList}
                  className="h-11 bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {showList ? 'Hide All Staff' : 'List All Staff'}
                </Button>
              </div>

              {trimmedSearch ? (
                <div className="mt-4 rounded-xl border border-border bg-background p-3">
                  {isSearching ? (
                    <p className="text-sm text-muted-foreground">Searching...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No staff found.</p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {searchResults.map((staff) => (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => {
                            handleOpenStaffDashboard(staff.id);
                          }}
                          className="group rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary hover:bg-accent/30"
                        >
                          <p className="font-semibold text-foreground">
                            {staff.fullName || `Staff #${staff.id}`}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {[staff.role, staff.specialization].filter(Boolean).join(' - ') ||
                              'No role'}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{staff.contactNumber || staff.email || 'No contact'}</span>
                            <ChevronRight className="size-3.5 opacity-80 transition group-hover:translate-x-0.5" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
                  Start typing in the search bar to open a staff dashboard.
                </div>
              )}
            </section>

            {showList ? (
              <section className="rounded-2xl border bg-background p-3 md:p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="size-4" />
                  <span>All staff table</span>
                </div>
                <EntityList
                  config={staffConfig}
                  fetchHook={useStaffList}
                  useCreate={useCreateStaff}
                  useUpdate={useUpdateStaff}
                  useDelete={useDeleteStaff}
                />
              </section>
            ) : isPreparingList ? (
              <section className="rounded-2xl border bg-background p-3 md:p-4">
                <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="size-4" />
                  <span>Preparing all staff table...</span>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
