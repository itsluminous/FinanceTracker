'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Calendar } from './ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { HighMediumRiskAssets, LowRiskAssets, FinancialEntry } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { ChevronDown, ChevronUp, CalendarIcon, Trash2 } from 'lucide-react';
import { FinancialEntryFormSkeleton } from './loading-skeletons';
import { clearAllCache } from '@/lib/cache';

interface FinancialEntryFormProps {
  profileId: string;
  onSuccess?: () => void;
}

export function FinancialEntryForm({ profileId, onSuccess }: FinancialEntryFormProps) {
  const { toast } = useToast();
  const [entryDate, setEntryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [highMediumRisk, setHighMediumRisk] = useState<HighMediumRiskAssets>({
    direct_equity: 0,
    esops: 0,
    equity_pms: 0,
    ulip: 0,
    real_estate: 0,
    real_estate_funds: 0,
    private_equity: 0,
    equity_mutual_funds: 0,
    structured_products_equity: 0,
  });
  const [lowRisk, setLowRisk] = useState<LowRiskAssets>({
    bank_balance: 0,
    debt_mutual_funds: 0,
    endowment_plans: 0,
    fixed_deposits: 0,
    nps: 0,
    epf: 0,
    ppf: 0,
    structured_products_debt: 0,
    gold_etfs_funds: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLatest, setIsLoadingLatest] = useState(true);
  const [isLoadingByDate, setIsLoadingByDate] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [entryDates, setEntryDates] = useState<string[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [existingEntry, setExistingEntry] = useState<FinancialEntry | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Collapsible sections state for mobile
  const [highMediumRiskExpanded, setHighMediumRiskExpanded] = useState(true);
  const [lowRiskExpanded, setLowRiskExpanded] = useState(true);

  // Draft saving key
  const draftKey = `financial-entry-draft-${profileId}`;

  // Helper function to format date as dd/mm/yyyy
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString + 'T00:00:00');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Load draft from local storage on mount
  useEffect(() => {
    const loadDraft = () => {
      try {
        const draft = localStorage.getItem(draftKey);
        if (draft) {
          const parsed = JSON.parse(draft);
          if (parsed.entryDate) setEntryDate(parsed.entryDate);
          if (parsed.highMediumRisk) setHighMediumRisk(parsed.highMediumRisk);
          if (parsed.lowRisk) setLowRisk(parsed.lowRisk);
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    };
    
    loadDraft();
  }, [profileId, draftKey]);

  // Save draft to local storage on changes
  useEffect(() => {
    const saveDraft = () => {
      try {
        const draft = {
          entryDate,
          highMediumRisk,
          lowRisk,
          timestamp: Date.now(),
        };
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch (error) {
        console.error('Error saving draft:', error);
      }
    };

    // Debounce draft saving
    const timeoutId = setTimeout(saveDraft, 1000);
    return () => clearTimeout(timeoutId);
  }, [entryDate, highMediumRisk, lowRisk, draftKey]);

  // Calculate totals
  const totalHighMediumRisk = Object.values(highMediumRisk).reduce(
    (sum, val) => sum + val,
    0
  );
  const totalLowRisk = Object.values(lowRisk).reduce((sum, val) => sum + val, 0);
  const totalAssets = totalHighMediumRisk + totalLowRisk;

  // Fetch latest entry to pre-fill form
  const fetchLatestEntry = async () => {
    try {
      setIsLoadingLatest(true);
      // Get the current session to get the access token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No session found');
        setIsLoadingLatest(false);
        return;
      }

      const response = await fetch(`/api/profiles/${profileId}/entries/latest`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.entry) {
          // Pre-fill with latest data
          setHighMediumRisk({
            direct_equity: data.entry.direct_equity || 0,
            esops: data.entry.esops || 0,
            equity_pms: data.entry.equity_pms || 0,
            ulip: data.entry.ulip || 0,
            real_estate: data.entry.real_estate || 0,
            real_estate_funds: data.entry.real_estate_funds || 0,
            private_equity: data.entry.private_equity || 0,
            equity_mutual_funds: data.entry.equity_mutual_funds || 0,
            structured_products_equity: data.entry.structured_products_equity || 0,
          });
          setLowRisk({
            bank_balance: data.entry.bank_balance || 0,
            debt_mutual_funds: data.entry.debt_mutual_funds || 0,
            endowment_plans: data.entry.endowment_plans || 0,
            fixed_deposits: data.entry.fixed_deposits || 0,
            nps: data.entry.nps || 0,
            epf: data.entry.epf || 0,
            ppf: data.entry.ppf || 0,
            structured_products_debt: data.entry.structured_products_debt || 0,
            gold_etfs_funds: data.entry.gold_etfs_funds || 0,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching latest entry:', error);
    } finally {
      setIsLoadingLatest(false);
    }
  };

  // Fetch entry by specific date
  const fetchEntryByDate = async (date: string) => {
    try {
      setIsLoadingByDate(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No session found');
        return;
      }

      // First try to get entry for the exact date
      const response = await fetch(`/api/profiles/${profileId}/entries/by-date?date=${date}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.entry) {
          // Store the existing entry for edit mode
          setExistingEntry(data.entry);
          
          // Pre-fill with entry data for the selected date
          setHighMediumRisk({
            direct_equity: data.entry.direct_equity || 0,
            esops: data.entry.esops || 0,
            equity_pms: data.entry.equity_pms || 0,
            ulip: data.entry.ulip || 0,
            real_estate: data.entry.real_estate || 0,
            real_estate_funds: data.entry.real_estate_funds || 0,
            private_equity: data.entry.private_equity || 0,
            equity_mutual_funds: data.entry.equity_mutual_funds || 0,
            structured_products_equity: data.entry.structured_products_equity || 0,
          });
          setLowRisk({
            bank_balance: data.entry.bank_balance || 0,
            debt_mutual_funds: data.entry.debt_mutual_funds || 0,
            endowment_plans: data.entry.endowment_plans || 0,
            fixed_deposits: data.entry.fixed_deposits || 0,
            nps: data.entry.nps || 0,
            epf: data.entry.epf || 0,
            ppf: data.entry.ppf || 0,
            structured_products_debt: data.entry.structured_products_debt || 0,
            gold_etfs_funds: data.entry.gold_etfs_funds || 0,
          });
          
          toast({
            title: 'Entry Loaded',
            description: `Loaded existing entry for ${formatDate(date)}`,
          });
          return;
        } else {
          // No entry found for this date, clear existing entry state
          setExistingEntry(null);
        }
      }

      // If no entry found for exact date, try to get the last entry before this date
      const beforeResponse = await fetch(`/api/profiles/${profileId}/entries/before-date?date=${date}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (beforeResponse.ok) {
        const beforeData = await beforeResponse.json();
        if (beforeData.entry) {
          // Pre-fill with the last available entry before this date
          setHighMediumRisk({
            direct_equity: beforeData.entry.direct_equity || 0,
            esops: beforeData.entry.esops || 0,
            equity_pms: beforeData.entry.equity_pms || 0,
            ulip: beforeData.entry.ulip || 0,
            real_estate: beforeData.entry.real_estate || 0,
            real_estate_funds: beforeData.entry.real_estate_funds || 0,
            private_equity: beforeData.entry.private_equity || 0,
            equity_mutual_funds: beforeData.entry.equity_mutual_funds || 0,
            structured_products_equity: beforeData.entry.structured_products_equity || 0,
          });
          setLowRisk({
            bank_balance: beforeData.entry.bank_balance || 0,
            debt_mutual_funds: beforeData.entry.debt_mutual_funds || 0,
            endowment_plans: beforeData.entry.endowment_plans || 0,
            fixed_deposits: beforeData.entry.fixed_deposits || 0,
            nps: beforeData.entry.nps || 0,
            epf: beforeData.entry.epf || 0,
            ppf: beforeData.entry.ppf || 0,
            structured_products_debt: beforeData.entry.structured_products_debt || 0,
            gold_etfs_funds: beforeData.entry.gold_etfs_funds || 0,
          });
          
          const lastEntryDate = formatDate(beforeData.entry.entry_date);
          toast({
            title: 'Previous Entry Loaded',
            description: `No entry found for ${formatDate(date)}. Loaded data from ${lastEntryDate}.`,
          });
          return;
        }
      }

      // If no previous entry found either, use latest entry as fallback
      await fetchLatestEntry();
      toast({
        title: 'No Previous Entry Found',
        description: `No entries found before ${formatDate(date)}. Using latest entry as template.`,
      });
    } catch (error) {
      console.error('Error fetching entry by date:', error);
      toast({
        title: 'Error',
        description: 'Failed to load entry for selected date',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingByDate(false);
    }
  };

  // Fetch all entry dates for calendar highlighting
  const fetchEntryDates = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No session found');
        return;
      }

      const response = await fetch(`/api/profiles/${profileId}/entries/dates`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEntryDates(data.dates || []);
      }
    } catch (error) {
      console.error('Error fetching entry dates:', error);
    }
  };

  useEffect(() => {
    fetchLatestEntry();
    fetchEntryDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const handleHighMediumRiskChange = (name: string, value: number) => {
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    setHighMediumRisk((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLowRiskChange = (name: string, value: number) => {
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    setLowRisk((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Validate entry date
    if (!entryDate) {
      errors.entry_date = 'Entry date is required';
    } else {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(entryDate)) {
        errors.entry_date = 'Date must be in YYYY-MM-DD format';
      } else {
        // Validate that it's a valid date
        const date = new Date(entryDate);
        if (isNaN(date.getTime()) || date.toISOString().split('T')[0] !== entryDate) {
          errors.entry_date = 'Please enter a valid date';
        }
      }
    }
    
    // Validate decimal precision for all fields
    const validateDecimal = (value: number, fieldName: string) => {
      const decimalPlaces = value.toString().split('.')[1]?.length || 0;
      if (decimalPlaces > 2) {
        errors[fieldName] = 'Maximum 2 decimal places allowed';
      }
      if (value < 0) {
        errors[fieldName] = 'Value cannot be negative';
      }
    };
    
    Object.entries(highMediumRisk).forEach(([key, value]) => {
      validateDecimal(value, key);
    });
    
    Object.entries(lowRisk).forEach(([key, value]) => {
      validateDecimal(value, key);
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors in the form before submitting.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);

    try {
      // Get the current session to get the access token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('You must be logged in to save an entry');
      }

      let response;
      let successMessage;

      if (existingEntry) {
        // Update existing entry
        response = await fetch(`/api/entries/${existingEntry.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            entry_date: entryDate,
            high_medium_risk: highMediumRisk,
            low_risk: lowRisk,
          }),
        });
        successMessage = 'Financial entry updated successfully';
      } else {
        // Create new entry
        response = await fetch(`/api/profiles/${profileId}/entries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            entry_date: entryDate,
            high_medium_risk: highMediumRisk,
            low_risk: lowRisk,
          }),
        });
        successMessage = 'Financial entry saved successfully';
      }

      if (!response.ok) {
        const error = await response.json();
        
        // Handle specific error cases
        if (response.status === 403) {
          throw new Error('You do not have permission to edit this profile');
        } else if (response.status === 409) {
          throw new Error('An entry for this date already exists');
        } else if (response.status === 400) {
          throw new Error(error.error || 'Invalid data provided');
        }
        
        throw new Error(error.error || 'Failed to save entry');
      }

      // Clear draft on successful save
      try {
        localStorage.removeItem(draftKey);
      } catch (error) {
        console.error('Error clearing draft:', error);
      }

      // Clear all analytics cache to force refresh
      clearAllCache();

      // Refresh entry dates for calendar highlighting
      await fetchEntryDates();

      toast({
        title: 'Success',
        description: successMessage,
      });

      // Refetch latest entry to update form with saved data
      await fetchLatestEntry();

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving entry:', error);
      
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast({
          title: 'Network Error',
          description: 'Unable to save entry. Please check your connection and try again.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to save entry',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingEntry) return;
    
    setIsDeleting(true);

    try {
      // Get the current session to get the access token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('You must be logged in to delete an entry');
      }

      const response = await fetch(`/api/entries/${existingEntry.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Handle specific error cases
        if (response.status === 403) {
          throw new Error('You do not have permission to delete this entry');
        } else if (response.status === 404) {
          throw new Error('Entry not found');
        }
        
        throw new Error(error.error || 'Failed to delete entry');
      }

      // Clear the existing entry state
      setExistingEntry(null);

      // Clear draft on successful delete
      try {
        localStorage.removeItem(draftKey);
      } catch (error) {
        console.error('Error clearing draft:', error);
      }

      // Clear all analytics cache to force refresh
      clearAllCache();

      // Refresh entry dates for calendar highlighting
      await fetchEntryDates();

      // Reset form to latest entry
      await fetchLatestEntry();

      toast({
        title: 'Success',
        description: 'Financial entry deleted successfully',
      });

      setShowDeleteDialog(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast({
          title: 'Network Error',
          description: 'Unable to delete entry. Please check your connection and try again.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to delete entry',
          variant: 'destructive',
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoadingLatest) {
    return <FinancialEntryFormSkeleton />;
  }

  const highMediumRiskFields = [
    { name: 'direct_equity', label: 'Direct Equity', value: highMediumRisk.direct_equity },
    { name: 'esops', label: 'ESOPs', value: highMediumRisk.esops },
    { name: 'equity_pms', label: 'Equity PMS', value: highMediumRisk.equity_pms },
    { name: 'ulip', label: 'ULIP', value: highMediumRisk.ulip },
    { name: 'real_estate', label: 'Real Estate', value: highMediumRisk.real_estate },
    {
      name: 'real_estate_funds',
      label: 'Real Estate Funds',
      value: highMediumRisk.real_estate_funds,
    },
    { name: 'private_equity', label: 'Private Equity', value: highMediumRisk.private_equity },
    {
      name: 'equity_mutual_funds',
      label: 'Equity Mutual Funds',
      value: highMediumRisk.equity_mutual_funds,
    },
    {
      name: 'structured_products_equity',
      label: 'Structured Products - Equity',
      value: highMediumRisk.structured_products_equity,
    },
  ];

  const lowRiskFields = [
    { name: 'bank_balance', label: 'Bank Balance', value: lowRisk.bank_balance },
    {
      name: 'debt_mutual_funds',
      label: 'Debt Mutual Funds',
      value: lowRisk.debt_mutual_funds,
    },
    { name: 'endowment_plans', label: 'Endowment Plans', value: lowRisk.endowment_plans },
    { name: 'fixed_deposits', label: 'Fixed Deposits', value: lowRisk.fixed_deposits },
    { name: 'nps', label: 'NPS', value: lowRisk.nps },
    { name: 'epf', label: 'EPF', value: lowRisk.epf },
    { name: 'ppf', label: 'PPF', value: lowRisk.ppf },
    {
      name: 'structured_products_debt',
      label: 'Structured Products - Debt',
      value: lowRisk.structured_products_debt,
    },
    { name: 'gold_etfs_funds', label: 'Gold ETFs / Funds', value: lowRisk.gold_etfs_funds },
  ];

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>
            {existingEntry ? 'Edit Financial Entry' : 'Financial Entry'}
            {existingEntry && entryDate && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                for {formatDate(entryDate)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label htmlFor="entry_date" className={validationErrors.entry_date ? 'text-red-500' : ''}>
              Entry Date {validationErrors.entry_date && '*'}
            </Label>
            <div className="flex gap-2">
              <Input
                id="entry_date"
                type="text"
                value={entryDate ? formatDate(entryDate) : ''}
                onChange={(e) => {
                  const displayValue = e.target.value;
                  // Try to parse dd/mm/yyyy format
                  const ddmmyyyyRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
                  const match = displayValue.match(ddmmyyyyRegex);
                  
                  if (match) {
                    const [, day, month, year] = match;
                    const newDate = `${year}-${month}-${day}`;
                    setEntryDate(newDate);
                    if (validationErrors.entry_date) {
                      setValidationErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors.entry_date;
                        return newErrors;
                      });
                    }
                    // Fetch entry for the selected date
                    fetchEntryByDate(newDate);
                  } else if (displayValue === '') {
                    setEntryDate('');
                    setExistingEntry(null); // Clear existing entry when date is cleared
                  }
                }}
                placeholder="DD/MM/YYYY"
                required
                className={`flex-1 ${validationErrors.entry_date ? 'border-red-500' : ''}`}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowCalendar(!showCalendar)}
                className="shrink-0"
                aria-label="Open calendar"
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </div>
            {validationErrors.entry_date && (
              <p className="text-sm text-red-500">{validationErrors.entry_date}</p>
            )}
            
            {/* Calendar */}
            {showCalendar && (
              <div className="border rounded-lg p-2 bg-background">
                <Calendar
                  mode="single"
                  selected={entryDate ? new Date(entryDate + 'T00:00:00') : undefined}
                  defaultMonth={entryDate ? new Date(entryDate + 'T00:00:00') : new Date()}
                  onSelect={(date: Date | undefined) => {
                    if (date) {
                      // Format date as YYYY-MM-DD in local timezone
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      const dateString = `${year}-${month}-${day}`;
                      setEntryDate(dateString);
                      fetchEntryByDate(dateString);
                      setShowCalendar(false);
                    } else {
                      setExistingEntry(null); // Clear existing entry when date is cleared
                    }
                  }}
                  modifiers={{
                    hasEntry: entryDates.map(date => new Date(date + 'T00:00:00'))
                  }}
                  modifiersClassNames={{
                    hasEntry: "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100 dark:hover:bg-green-800"
                  }}
                  className="w-full"
                />
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 bg-green-100 dark:bg-green-900 rounded border"></div>
                  <span>Dates with existing entries</span>
                </div>
              </div>
            )}
            
            {isLoadingByDate && (
              <p className="text-sm text-muted-foreground">Loading entry for selected date...</p>
            )}
          </div>

          {/* High/Medium Risk Assets - Collapsible on mobile */}
          <div className="border rounded-lg overflow-hidden transition-smooth">
            <button
              type="button"
              onClick={() => setHighMediumRiskExpanded(!highMediumRiskExpanded)}
              className="w-full flex items-center justify-between p-4 bg-muted hover:bg-accent transition-colors sm:cursor-default sm:pointer-events-none"
            >
              <h3 className="text-lg font-semibold text-foreground">High/Medium Risk Assets</h3>
              <span className="sm:hidden">
                {highMediumRiskExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </span>
            </button>
            <div
              className={`p-4 transition-all duration-300 ${
                highMediumRiskExpanded ? 'block' : 'hidden sm:block'
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {highMediumRiskFields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label 
                      htmlFor={field.name}
                      className={validationErrors[field.name] ? 'text-red-500' : ''}
                    >
                      {field.label} {validationErrors[field.name] && '*'}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        ₹
                      </span>
                      <Input
                        id={field.name}
                        type="text"
                        inputMode="decimal"
                        value={field.value === 0 ? '' : field.value.toString()}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          if (inputValue === '') {
                            handleHighMediumRiskChange(field.name, 0);
                            return;
                          }
                          const decimalRegex = /^\d*\.?\d{0,2}$/;
                          if (!decimalRegex.test(inputValue)) return;
                          const numericValue = parseFloat(inputValue) || 0;
                          handleHighMediumRiskChange(field.name, numericValue);
                        }}
                        className={`pl-8 ${validationErrors[field.name] ? 'border-red-500' : ''}`}
                        placeholder="0.00"
                      />
                    </div>
                    {validationErrors[field.name] && (
                      <p className="text-xs text-red-500">{validationErrors[field.name]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Low Risk Assets - Collapsible on mobile */}
          <div className="border rounded-lg overflow-hidden transition-smooth">
            <button
              type="button"
              onClick={() => setLowRiskExpanded(!lowRiskExpanded)}
              className="w-full flex items-center justify-between p-4 bg-muted hover:bg-accent transition-colors sm:cursor-default sm:pointer-events-none"
            >
              <h3 className="text-lg font-semibold text-foreground">Low Risk Assets</h3>
              <span className="sm:hidden">
                {lowRiskExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </span>
            </button>
            <div
              className={`p-4 transition-all duration-300 ${
                lowRiskExpanded ? 'block' : 'hidden sm:block'
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowRiskFields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label 
                      htmlFor={field.name}
                      className={validationErrors[field.name] ? 'text-red-500' : ''}
                    >
                      {field.label} {validationErrors[field.name] && '*'}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        ₹
                      </span>
                      <Input
                        id={field.name}
                        type="text"
                        inputMode="decimal"
                        value={field.value === 0 ? '' : field.value.toString()}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          if (inputValue === '') {
                            handleLowRiskChange(field.name, 0);
                            return;
                          }
                          const decimalRegex = /^\d*\.?\d{0,2}$/;
                          if (!decimalRegex.test(inputValue)) return;
                          const numericValue = parseFloat(inputValue) || 0;
                          handleLowRiskChange(field.name, numericValue);
                        }}
                        className={`pl-8 ${validationErrors[field.name] ? 'border-red-500' : ''}`}
                        placeholder="0.00"
                      />
                    </div>
                    {validationErrors[field.name] && (
                      <p className="text-xs text-red-500">{validationErrors[field.name]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Total High/Medium Risk:</span>
              <span>₹ {totalHighMediumRisk.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium">Total Low Risk:</span>
              <span>₹ {totalLowRisk.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total Assets:</span>
              <span>₹ {totalAssets.toFixed(2)}</span>
            </div>
          </div>

          {/* Submit Buttons */}
          {existingEntry ? (
            <div className="flex gap-2">
              <Button 
                type="submit" 
                variant="secondary" 
                className="flex-1" 
                disabled={isLoading}
              >
                {isLoading ? 'Updating...' : 'Update Entry'}
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                onClick={() => setShowDeleteDialog(true)}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Entry
              </Button>
            </div>
          ) : (
            <Button type="submit" variant="secondary" className="w-full" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Entry'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the financial entry for {entryDate ? formatDate(entryDate) : 'this date'}? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2"
            >
              {isDeleting ? (
                'Deleting...'
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Entry
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
