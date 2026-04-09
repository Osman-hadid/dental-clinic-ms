'use client';

import { JSX, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clinicProfileConfig } from '@/modules/dental-management/presentation/config/clinic-profile-config';
import { useClinicProfile, useUpdateClinicProfile } from '@/modules/dental-management/presentation/hooks';
import { toast } from 'sonner';
import { Building2, Settings, Image as ImageIcon, Phone, Mail, Globe, FileText, Upload, MapPin, BadgeCheck } from 'lucide-react';

// eslint-disable-next-line react/function-component-definition
export default function ClinicProfilePage(): JSX.Element {
  const t = useTranslations('clinicProfile');
  const tSidebar = useTranslations('sidebar.dentalManagement');
  const { data: clinicProfileResponse } = useClinicProfile();
  const updateMutation = useUpdateClinicProfile();
  const profile = clinicProfileResponse?.data ?? null;

  const [formData, setFormData] = useState({
    logoPath: profile?.logoPath ?? '',
    name: profile?.name ?? '',
    ownerName: profile?.ownerName ?? '',
    address: profile?.address ?? '',
    contactNumber: profile?.contactNumber ?? '',
    email: profile?.email ?? '',
    website: profile?.website ?? '',
    licenseNumber: profile?.licenseNumber ?? '',
    notes: profile?.notes ?? '',
  });

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const response = await updateMutation.mutateAsync(formData);

    if (response.success) {
      toast.success(t('messages.updateSuccess'));
    } else {
      toast.error(response.error?.message ?? t('messages.updateFailed'));
    }
  };

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'clinicProfile', isCurrent: true, label: t('page.title') },
        ]}
      />
      <div className="flex flex-1 flex-col px-4 pb-6 lg:px-6 overflow-x-hidden">
        <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 via-background to-muted/20 p-6 text-foreground shadow-lg overflow-hidden relative">
          <div className="absolute right-0 top-0 h-48 w-48 translate-x-24 -translate-y-24 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute left-0 bottom-0 h-48 w-48 -translate-x-24 translate-y-24 rounded-full bg-emerald-500/10 blur-3xl" />
          
          <div className="relative mb-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-blue-200/50 bg-blue-100/60 p-2.5">
                <Building2 className="size-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">{t('page.title')}</h1>
                <p className="text-sm text-muted-foreground">{t('page.description')}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="relative space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-white/80 to-muted/50 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="rounded-lg border border-blue-200/50 bg-blue-100/60 p-2">
                      <ImageIcon className="size-4 text-blue-600" />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">Clinic Branding</h2>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        <Upload className="size-3" />
                        {t('config.form.logoPath.label')}
                      </label>
                      <div className="relative">
                        <Input
                          type="file"
                          accept="image/*"
                          className="h-10 border-border/60 bg-background/80 text-sm"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setFormData({ ...formData, logoPath: file.name });
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t('config.form.name.label')} <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="h-10 border-border/60 bg-background/80 text-sm"
                        placeholder="Enter clinic name"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        {t('config.form.ownerName.label')} <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        value={formData.ownerName}
                        onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                        className="h-10 border-border/60 bg-background/80 text-sm"
                        placeholder="Enter owner name"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-white/80 to-muted/50 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="rounded-lg border border-violet-200/50 bg-violet-100/60 p-2">
                      <MapPin className="size-4 text-violet-600" />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">Location & Contact</h2>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        <MapPin className="size-3" />
                        {t('config.form.address.label')}
                      </label>
                      <Input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="h-10 border-border/60 bg-background/80 text-sm"
                        placeholder="Enter clinic address"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        <Phone className="size-3" />
                        {t('config.form.contactNumber.label')}
                      </label>
                      <Input
                        type="tel"
                        value={formData.contactNumber}
                        onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                        className="h-10 border-border/60 bg-background/80 text-sm"
                        placeholder="Enter contact number"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        <Mail className="size-3" />
                        {t('config.form.email.label')}
                      </label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="h-10 border-border/60 bg-background/80 text-sm"
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-white/80 to-muted/50 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="rounded-lg border border-emerald-200/50 bg-emerald-100/60 p-2">
                      <Globe className="size-4 text-emerald-600" />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">Online Presence</h2>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        <Globe className="size-3" />
                        {t('config.form.website.label')}
                      </label>
                      <Input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="h-10 border-border/60 bg-background/80 text-sm"
                        placeholder="https://example.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        <BadgeCheck className="size-3" />
                        {t('config.form.licenseNumber.label')}
                      </label>
                      <Input
                        type="text"
                        value={formData.licenseNumber}
                        onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                        className="h-10 border-border/60 bg-background/80 text-sm"
                        placeholder="Enter license number"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-white/80 to-muted/50 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="rounded-lg border border-amber-200/50 bg-amber-100/60 p-2">
                      <FileText className="size-4 text-amber-600" />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">Additional Information</h2>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <FileText className="size-3" />
                      {t('config.form.notes.label')}
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full h-32 rounded-lg border border-border/60 bg-background/80 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Enter additional notes..."
                      maxLength={1000}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {formData.notes.length}/1000
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-white/80 to-muted/50 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="rounded-lg border border-primary/50 bg-primary/10 p-2">
                      <Settings className="size-4 text-primary" />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">Actions</h2>
                  </div>
                  
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="w-full h-11 bg-gradient-to-r from-primary to-primary/90 text-white hover:from-primary/90 hover:to-primary font-medium shadow-lg shadow-primary/20"
                  >
                    {updateMutation.isPending ? 'Saving...' : t('config.table.update')}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
