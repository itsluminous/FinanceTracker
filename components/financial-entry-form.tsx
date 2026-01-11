'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { HighMediumRiskAssets, LowRiskAssets } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Collapsible sections state for mobile
  const [highMediumRiskExpanded, setHighMediumRiskExpanded] = useState(true);
  const [lowRiskExpanded, setLowRiskExpanded] = useState(true);

  // Draft saving key
  const draftKey = `financial-entry-draft-${profileId}`;

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
  useEffect(() => {
    const fetchLatestEntry = async () => {
      try {
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

    fetchLatestEntry();
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

      const response = await fetch(`/api/profiles/${profileId}/entries`, {
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

      toast({
        title: 'Success',
        description: 'Financial entry saved successfully',
      });

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

  if (isLoadingLatest) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
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
          <CardTitle>Financial Entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label htmlFor="entry_date" className={validationErrors.entry_date ? 'text-red-500' : ''}>
              Entry Date {validationErrors.entry_date && '*'}
            </Label>
            <Input
              id="entry_date"
              type="date"
              value={entryDate}
              onChange={(e) => {
                setEntryDate(e.target.value);
                if (validationErrors.entry_date) {
                  setValidationErrors((prev) => {
                    const newErrors = { ...prev };
                    delete newErrors.entry_date;
                    return newErrors;
                  });
                }
              }}
              required
              className={`w-full ${validationErrors.entry_date ? 'border-red-500' : ''}`}
            />
            {validationErrors.entry_date && (
              <p className="text-sm text-red-500">{validationErrors.entry_date}</p>
            )}
          </div>

          {/* High/Medium Risk Assets - Collapsible on mobile */}
          <div className="border rounded-lg overflow-hidden transition-smooth">
            <button
              type="button"
              onClick={() => setHighMediumRiskExpanded(!highMediumRiskExpanded)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors sm:cursor-default sm:pointer-events-none"
            >
              <h3 className="text-lg font-semibold">High/Medium Risk Assets</h3>
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
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors sm:cursor-default sm:pointer-events-none"
            >
              <h3 className="text-lg font-semibold">Low Risk Assets</h3>
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

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Entry'}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
