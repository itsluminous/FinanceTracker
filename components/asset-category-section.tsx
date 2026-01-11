'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AssetField {
  name: string;
  label: string;
  value: number;
}

interface AssetCategorySectionProps {
  title: string;
  fields: AssetField[];
  onChange: (name: string, value: number) => void;
}

/**
 * AssetCategorySection - Reusable component for asset input groups
 * Handles decimal number validation and currency formatting
 */
export function AssetCategorySection({
  title,
  fields,
  onChange,
}: AssetCategorySectionProps) {
  const handleInputChange = (name: string, inputValue: string) => {
    // Allow empty string
    if (inputValue === '') {
      onChange(name, 0);
      return;
    }

    // Validate decimal format (allow numbers with up to 2 decimal places)
    const decimalRegex = /^\d*\.?\d{0,2}$/;
    if (!decimalRegex.test(inputValue)) {
      return; // Don't update if invalid format
    }

    const numericValue = parseFloat(inputValue) || 0;
    onChange(name, numericValue);
  };

  const formatCurrency = (value: number): string => {
    if (value === 0) return '';
    return value.toString();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                ₹
              </span>
              <Input
                id={field.name}
                type="text"
                inputMode="decimal"
                value={formatCurrency(field.value)}
                onChange={(e) => handleInputChange(field.name, e.target.value)}
                className="pl-8"
                placeholder="0.00"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
