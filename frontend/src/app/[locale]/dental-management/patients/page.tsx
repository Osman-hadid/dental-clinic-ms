'use client';

import { JSX, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { EntityListClient as EntityList } from '@/components/shared/entity/entity-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { patientConfig } from '@/modules/dental-management/presentation/config/patient-config';
import {
  useCreatePatient,
  useDeletePatient,
  usePatientList,
  useUpdatePatient,
} from '@/modules/dental-management/presentation/hooks';
import { CalendarDays, ChevronRight, Search, UsersRound } from 'lucide-react';

const TABLE_PER_PAGE = 100;
const SEARCH_PAGE_SIZE = 100;
const SEARCH_RESULTS_VISIBLE_LIMIT = 12;

const normalizeSearchValue = (value: string): string =>
  value.replace(/\s+/g, ' ').trim().toLowerCase();

const tokenizeSearchValue = (value: string): string[] =>
  normalizeSearchValue(value).split(' ').filter(Boolean);

const computeSearchPriority = (value: string, query: string): number => {
  const normalizedValue = normalizeSearchValue(value);
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedValue || !normalizedQuery) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (normalizedValue === normalizedQuery) {
    return 0;
  }

  if (normalizedValue.startsWith(normalizedQuery)) {
    return 1;
  }

  const wordIndex = normalizedValue.indexOf(` ${normalizedQuery}`);
  if (wordIndex >= 0) {
    return 2 + wordIndex;
  }

  const includesIndex = normalizedValue.indexOf(normalizedQuery);
  if (includesIndex >= 0) {
    return 100 + includesIndex;
  }

  return Number.MAX_SAFE_INTEGER;
};

const computeHumanSearchScore = (
  patient: {
    contactNumber?: string | null;
    firstName?: string | null;
    id?: string | number | null;
    lastName?: string | null;
    patientCode?: string | null;
  },
  query: string
): number => {
  const normalizedQuery = normalizeSearchValue(query);
  const queryTokens = tokenizeSearchValue(query);
  const patientId = String(patient.id ?? '');
  const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim();
  const reversedName = [patient.lastName, patient.firstName].filter(Boolean).join(' ').trim();
  const patientCode = String(patient.patientCode ?? '');
  const contactNumber = String(patient.contactNumber ?? '');
  const candidateFields = [patientId, patientCode, fullName, reversedName, contactNumber];

  let score = Number.MAX_SAFE_INTEGER;

  candidateFields.forEach((field, fieldIndex) => {
    const priority = computeSearchPriority(field, normalizedQuery);
    if (priority !== Number.MAX_SAFE_INTEGER) {
      score = Math.min(score, priority + fieldIndex * 1000);
    }

    const normalizedField = normalizeSearchValue(field);
    const fieldTokens = tokenizeSearchValue(field);

    if (normalizedField && normalizedQuery) {
      queryTokens.forEach((token, tokenIndex) => {
        if (!token) {
          return;
        }

        if (fieldTokens.includes(token)) {
          score = Math.min(score, 200 + tokenIndex + fieldIndex * 1000);
          return;
        }

        const tokenPrefixIndex = fieldTokens.findIndex((fieldToken) =>
          fieldToken.startsWith(token)
        );
        if (tokenPrefixIndex >= 0) {
          score = Math.min(score, 300 + tokenIndex * 10 + tokenPrefixIndex + fieldIndex * 1000);
          return;
        }

        const containsIndex = normalizedField.indexOf(token);
        if (containsIndex >= 0) {
          score = Math.min(score, 500 + tokenIndex * 10 + containsIndex + fieldIndex * 1000);
        }
      });
    }
  });

  if (score !== Number.MAX_SAFE_INTEGER) {
    return score;
  }

  return 900000 + String(patient.id ?? '').length;
};

const buildPatientSearchBlob = (patient: {
  address?: string | null;
  bloodGroup?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  emergencyContact?: string | null;
  firstName?: string | null;
  id?: string | number | null;
  lastName?: string | null;
  patientCode?: string | null;
}): string => {
  return [
    patient.patientCode,
    patient.firstName,
    patient.lastName,
    [patient.firstName, patient.lastName].filter(Boolean).join(' '),
    [patient.lastName, patient.firstName].filter(Boolean).join(' '),
    patient.contactNumber,
    patient.email,
    patient.address,
    patient.bloodGroup,
    patient.emergencyContact,
    patient.id,
  ]
    .map((value) => String(value ?? ''))
    .map(normalizeSearchValue)
    .filter(Boolean)
    .join(' ');
};

// eslint-disable-next-line react/function-component-definition
export default function PatientsPage(): JSX.Element {
  const t = useTranslations('patient');
  const tSidebar = useTranslations('sidebar.dentalManagement');
  const locale = useLocale();
  const router = useRouter();
  const searchParameters = useSearchParams();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showList, setShowList] = useState(false);
  const [isPreparingList, setIsPreparingList] = useState(false);

  // Debounce search to prevent API calls on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  const trimmedSearch = debouncedSearch.trim();
  const searchFields = useMemo(
    () => ['id', 'patientCode', 'firstName', 'lastName', 'contactNumber', 'email'],
    []
  );

  const searchPageSize = trimmedSearch ? SEARCH_PAGE_SIZE : TABLE_PER_PAGE;
  const { entities: searchResults, isFetching: isSearching } = usePatientList(
    1,
    searchPageSize,
    trimmedSearch,
    searchFields,
    [],
    {}
  );

  const filteredSearchResults = useMemo(() => {
    if (!trimmedSearch) {
      return [];
    }

    const normalizedSearch = normalizeSearchValue(trimmedSearch);
    if (!normalizedSearch) {
      return [];
    }

    const searchTokens = tokenizeSearchValue(trimmedSearch);

    return searchResults
      .filter((patient) => {
        const searchBlob = buildPatientSearchBlob(patient);

        // Check if all search tokens are found in the search blob
        return searchTokens.every((token) => {
          const normalizedToken = normalizeSearchValue(token);
          return searchBlob.includes(normalizedToken);
        });
      })
      .sort((left, right) => {
        const leftScore = computeHumanSearchScore(left, trimmedSearch);
        const rightScore = computeHumanSearchScore(right, trimmedSearch);

        if (leftScore !== rightScore) {
          return leftScore - rightScore;
        }

        const leftFullName = [left.firstName, left.lastName].filter(Boolean).join(' ').trim();
        const rightFullName = [right.firstName, right.lastName].filter(Boolean).join(' ').trim();
        const leftLabel = leftFullName || left.patientCode || String(left.id);
        const rightLabel = rightFullName || right.patientCode || String(right.id);

        return leftLabel.localeCompare(rightLabel, undefined, { sensitivity: 'base' });
      });
  }, [searchResults, trimmedSearch]);

  const visibleSearchResults = useMemo(
    () => filteredSearchResults.slice(0, SEARCH_RESULTS_VISIBLE_LIMIT),
    [filteredSearchResults]
  );

  const { entities: dashboardPatients } = usePatientList(
    1,
    TABLE_PER_PAGE,
    '',
    searchFields,
    [],
    {}
  );

  const activePatients = useMemo(
    () => dashboardPatients.filter((patient) => String(patient.enabled) === '1').length,
    [dashboardPatients]
  );

  const approvedPatients = useMemo(
    () => dashboardPatients.filter((patient) => patient.status === 'approved').length,
    [dashboardPatients]
  );

  const handleOpenPatient = (patientId: string | number): void => {
    const encodedPatientId = encodeURIComponent(String(patientId));
    router.push(
      `/${locale}/dental-management/patients/patient-profile?patientId=${encodedPatientId}`
    );
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

    // Reset table query state so "All patients table" is not accidentally filtered.
    setIsPreparingList(true);
    router.replace(`?page=1&perPage=${TABLE_PER_PAGE}`, { scroll: false });
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'patients', isCurrent: true, label: t(patientConfig.title) },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <Card className="relative isolate overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-lg">
              {/* <div className="absolute right-0 top-0 h-48 w-48 translate-x-24 -translate-y-24 rounded-full bg-primary/10 blur-3xl" /> */}
              <div className="absolute left-0 bottom-0 h-48 w-48 -translate-x-24 translate-y-24 rounded-full bg-emerald-500/10 blur-3xl" />

              <CardContent className="relative p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
                      <UsersRound className="size-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Dental Dashboard
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold text-foreground">
                        Patient Finder
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Search quickly, open profile, and move directly to clinical workflow.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-xl border border-emerald-200/60 bg-linear-to-br from-emerald-50/80 to-emerald-100/50 px-4 py-2 dark:border-emerald-400/20 dark:from-emerald-500/16 dark:to-emerald-500/6">
                      <div className="flex items-center gap-2">
                        <UsersRound className="size-4 text-emerald-600 dark:text-emerald-300" />
                        <div>
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-200/80">
                            Total
                          </p>
                          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-50">
                            {dashboardPatients.length}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-blue-200/60 bg-linear-to-br from-blue-50/80 to-blue-100/50 px-4 py-2 dark:border-blue-400/20 dark:from-blue-500/16 dark:to-blue-500/6">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg border border-blue-200/50 bg-blue-100/60 p-1.5 dark:border-blue-400/20 dark:bg-blue-500/16">
                          <UsersRound className="size-3 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div>
                          <p className="text-[10px] text-blue-700 dark:text-blue-200/80">Active</p>
                          <p className="text-sm font-bold text-blue-900 dark:text-blue-50">
                            {activePatients}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-violet-200/60 bg-linear-to-br from-violet-50/80 to-violet-100/50 px-4 py-2 dark:border-violet-400/20 dark:from-violet-500/16 dark:to-violet-500/6">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg border border-violet-200/50 bg-violet-100/60 p-1.5 dark:border-violet-400/20 dark:bg-violet-500/16">
                          <UsersRound className="size-3 text-violet-600 dark:text-violet-300" />
                        </div>
                        <div>
                          <p className="text-[10px] text-violet-700 dark:text-violet-200/80">
                            Approved
                          </p>
                          <p className="text-sm font-bold text-violet-900 dark:text-violet-50">
                            {approvedPatients}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                      }}
                      placeholder="Search patient by name, ID, code, phone..."
                      className="h-12 border-input bg-background pl-12 text-base text-foreground placeholder:text-muted-foreground rounded-xl"
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleToggleList}
                    className="h-12 bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground rounded-xl px-6 text-base font-medium"
                  >
                    {showList ? 'Hide All Patients' : 'List All Patients'}
                  </Button>
                </div>

                {trimmedSearch ? (
                  <div className="mt-6 rounded-2xl border border-border/50 bg-card/70 p-4">
                    {isSearching ? (
                      <div className="flex items-center justify-center py-8 text-center">
                        <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 mb-3">
                          <Search className="size-6 text-primary animate-pulse" />
                        </div>
                        <p className="text-sm text-muted-foreground">Searching patients...</p>
                      </div>
                    ) : filteredSearchResults.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="rounded-xl border border-border/50 bg-muted/30 p-4 mb-3">
                          <Search className="size-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          No patients found matching your search.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-foreground">
                          {visibleSearchResults.length} patient
                          {visibleSearchResults.length !== 1 ? 's' : ''} found
                        </p>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {visibleSearchResults.map((patient) => {
                            const fullName =
                              [patient.firstName, patient.lastName]
                                .filter(Boolean)
                                .join(' ')
                                .trim() || patient.patientCode;
                            return (
                              <button
                                key={patient.id}
                                type="button"
                                onClick={() => {
                                  handleOpenPatient(patient.id);
                                }}
                                className="group rounded-2xl border border-border/50 bg-card p-4 text-left transition-all hover:scale-[1.02] hover:border-primary/50 hover:bg-accent/30 hover:shadow-lg"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <p className="text-base font-semibold text-foreground">
                                      {fullName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {patient.patientCode}
                                    </p>
                                  </div>
                                  <ChevronRight className="size-5 text-muted-foreground opacity-50 transition group-hover:translate-x-1 group-hover:opacity-100" />
                                </div>
                                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                                  <div className="rounded-lg border border-border/50 bg-background/60 px-2 py-1">
                                    {patient.contactNumber || 'No phone'}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-dashed border-border/50 bg-card/60 p-6 text-center">
                    <div className="rounded-xl border border-border/50 bg-muted/30 p-4 mx-auto mb-3 max-w-fit">
                      <Search className="size-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Start typing in the search bar to find and open a patient profile.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {showList ? (
              <Card className="rounded-3xl border border-border/50 bg-card shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-violet-200/50 bg-violet-100/60 p-2 dark:border-violet-400/20 dark:bg-violet-500/16">
                      <CalendarDays className="size-5 text-violet-600 dark:text-violet-300" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-foreground">All Patients</CardTitle>
                      <CardDescription>Complete patient records database</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <EntityList
                    config={patientConfig}
                    fetchHook={usePatientList}
                    useCreate={useCreatePatient}
                    useUpdate={useUpdatePatient}
                    useDelete={useDeletePatient}
                  />
                </CardContent>
              </Card>
            ) : isPreparingList ? (
              <Card className="rounded-3xl border border-border/50 bg-card shadow-sm">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 mb-4">
                    <CalendarDays className="size-8 text-primary animate-pulse" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Preparing patients table...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please wait while we load the complete database
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
