import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, ChevronDown, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  brands,
  cpuTypes,
  ramOptions,
  storageOptions,
  displaySizes,
  weightOptions,
  discountOptions,
  sortOptions,
} from '@/data/laptops';
import type { FilterState } from '@/types';

interface FiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  totalProducts: number;
  filteredCount: number;
}

export default function Filters({ filters, onFilterChange, totalProducts, filteredCount }: FiltersProps) {
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key: keyof FilterState, value: string) => {
    const current = filters[key] as string[];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFilter(key as keyof FilterState, updated as FilterState[keyof FilterState]);
  };

  const clearFilters = () => {
    onFilterChange({
      category: [],
      brand: [],
      priceRange: [0, 10000000],
      cpu: [],
      ram: [],
      storage: [],
      displaySize: [],
      weight: [],
      discount: [],
      stock: [],
      sort: 'discount',
    });
  };

  const activeFiltersCount =
    filters.brand.length +
    filters.cpu.length +
    filters.ram.length +
    filters.storage.length +
    filters.displaySize.length +
    filters.weight.length +
    filters.discount.length +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < 10000000 ? 1 : 0);

  // Filter Button Component
  const FilterButton = ({ 
    label, 
    options, 
    selected, 
    onSelect 
  }: { 
    label: string; 
    options: string[]; 
    selected: string[]; 
    onSelect: (value: string) => void;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant={selected.length > 0 ? "default" : "outline"} 
          size="sm" 
          className="h-9 px-3 text-sm whitespace-nowrap"
        >
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
          {options.map((option) => (
            <div key={option} className="flex items-center space-x-2">
              <Checkbox
                id={option}
                checked={selected.includes(option)}
                onCheckedChange={() => onSelect(option)}
              />
              <Label htmlFor={option} className="text-sm cursor-pointer flex-1">
                {option}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  // Quick Filter Chips
  const QuickFilterChip = ({ 
    label, 
    isActive, 
    onClick 
  }: { 
    label: string; 
    isActive: boolean; 
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
        isActive
          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="sticky top-16 lg:top-20 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-3">
        <div className="max-w-[1920px] mx-auto">
          {/* Top Row: Product Count, Sort, Filter Actions */}
          <div className="flex items-center justify-between gap-4 mb-3">
            {/* Left: Product Count */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {filteredCount.toLocaleString()}개
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">
                / {totalProducts.toLocaleString()}개
              </span>
            </div>

            {/* Right: Sort & Actions */}
            <div className="flex items-center gap-2">
              {/* Sort Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5">
                    <span className="hidden sm:inline">
                      {sortOptions.find((o) => o.value === filters.sort)?.label}
                    </span>
                    <span className="sm:hidden">정렬</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1" align="end">
                  {sortOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={filters.sort === option.value ? 'default' : 'ghost'}
                      size="sm"
                      className="w-full justify-start text-sm"
                      onClick={() => updateFilter('sort', option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>

              {/* Filter Sheet Trigger */}
              <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant={activeFiltersCount > 0 ? "default" : "outline"} 
                    size="sm" 
                    className="h-9 gap-1.5"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">필터</span>
                    {activeFiltersCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-96 p-0">
                  <SheetHeader className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <SheetTitle>필터</SheetTitle>
                      {activeFiltersCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                          <RotateCcw className="w-4 h-4 mr-1" />
                          초기화
                        </Button>
                      )}
                    </div>
                  </SheetHeader>
                  <div className="p-4 space-y-6 overflow-y-auto h-[calc(100vh-140px)]">
                    {/* Price Range */}
                    <div>
                      <Label className="text-sm font-semibold mb-3 block">가격 범위</Label>
                      <Slider
                        value={filters.priceRange}
                        onValueChange={(value) => updateFilter('priceRange', value as [number, number])}
                        max={10000000}
                        step={100000}
                        className="mb-3"
                      />
                      <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                        <span>{filters.priceRange[0].toLocaleString()}원</span>
                        <span>{filters.priceRange[1].toLocaleString()}원</span>
                      </div>
                    </div>

                    {/* Brand */}
                    <div>
                      <Label className="text-sm font-semibold mb-3 block">브랜드</Label>
                      <div className="flex flex-wrap gap-2">
                        {brands.map((brand) => (
                          <QuickFilterChip
                            key={brand}
                            label={brand}
                            isActive={filters.brand.includes(brand)}
                            onClick={() => toggleArrayFilter('brand', brand)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* CPU */}
                    <div>
                      <Label className="text-sm font-semibold mb-3 block">프로세서</Label>
                      <div className="flex flex-wrap gap-2">
                        {cpuTypes.map((cpu) => (
                          <QuickFilterChip
                            key={cpu}
                            label={cpu}
                            isActive={filters.cpu.includes(cpu)}
                            onClick={() => toggleArrayFilter('cpu', cpu)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* RAM */}
                    <div>
                      <Label className="text-sm font-semibold mb-3 block">RAM</Label>
                      <div className="flex flex-wrap gap-2">
                        {ramOptions.map((ram) => (
                          <QuickFilterChip
                            key={ram}
                            label={ram}
                            isActive={filters.ram.includes(ram)}
                            onClick={() => toggleArrayFilter('ram', ram)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Storage */}
                    <div>
                      <Label className="text-sm font-semibold mb-3 block">저장공간</Label>
                      <div className="flex flex-wrap gap-2">
                        {storageOptions.map((storage) => (
                          <QuickFilterChip
                            key={storage}
                            label={storage}
                            isActive={filters.storage.includes(storage)}
                            onClick={() => toggleArrayFilter('storage', storage)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Display Size */}
                    <div>
                      <Label className="text-sm font-semibold mb-3 block">화면 크기</Label>
                      <div className="flex flex-wrap gap-2">
                        {displaySizes.map((size) => (
                          <QuickFilterChip
                            key={size}
                            label={size}
                            isActive={filters.displaySize.includes(size)}
                            onClick={() => toggleArrayFilter('displaySize', size)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Weight */}
                    <div>
                      <Label className="text-sm font-semibold mb-3 block">무게</Label>
                      <div className="flex flex-wrap gap-2">
                        {weightOptions.map((weight) => (
                          <QuickFilterChip
                            key={weight}
                            label={weight}
                            isActive={filters.weight.includes(weight)}
                            onClick={() => toggleArrayFilter('weight', weight)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Discount */}
                    <div>
                      <Label className="text-sm font-semibold mb-3 block">할인율</Label>
                      <div className="flex flex-wrap gap-2">
                        {discountOptions.map((option) => (
                          <QuickFilterChip
                            key={option.value}
                            label={option.label}
                            isActive={filters.discount.includes(option.value)}
                            onClick={() => toggleArrayFilter('discount', option.value)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 border-t">
                    <Button className="w-full" onClick={() => setIsFilterSheetOpen(false)}>
                      {filteredCount}개 상품 보기
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Clear Filters */}
              {activeFiltersCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 px-2 text-slate-500 hidden sm:flex"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Quick Filter Chips Row */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1">
            {/* Price Range Quick Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant={(filters.priceRange[0] > 0 || filters.priceRange[1] < 10000000) ? "default" : "outline"} 
                  size="sm" 
                  className="h-8 px-3 text-xs whitespace-nowrap flex-shrink-0"
                >
                  가격
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3">
                <Label className="text-sm font-semibold mb-3 block">가격 범위</Label>
                <Slider
                  value={filters.priceRange}
                  onValueChange={(value) => updateFilter('priceRange', value as [number, number])}
                  max={10000000}
                  step={100000}
                  className="mb-3"
                />
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>{filters.priceRange[0].toLocaleString()}원</span>
                  <span>{filters.priceRange[1].toLocaleString()}원</span>
                </div>
              </PopoverContent>
            </Popover>

            {/* Brand Quick Filter */}
            <FilterButton
              label="브랜드"
              options={brands}
              selected={filters.brand}
              onSelect={(value) => toggleArrayFilter('brand', value)}
            />

            {/* RAM Quick Filter */}
            <FilterButton
              label="RAM"
              options={ramOptions}
              selected={filters.ram}
              onSelect={(value) => toggleArrayFilter('ram', value)}
            />

            {/* Storage Quick Filter */}
            <FilterButton
              label="저장공간"
              options={storageOptions}
              selected={filters.storage}
              onSelect={(value) => toggleArrayFilter('storage', value)}
            />

            {/* Display Size Quick Filter */}
            <FilterButton
              label="화면"
              options={displaySizes}
              selected={filters.displaySize}
              onSelect={(value) => toggleArrayFilter('displaySize', value)}
            />

            {/* Discount Quick Filter */}
            <FilterButton
              label="할인율"
              options={discountOptions.map(o => o.label)}
              selected={filters.discount.map(d => discountOptions.find(o => o.value === d)?.label || d)}
              onSelect={(value) => {
                const option = discountOptions.find(o => o.label === value);
                if (option) toggleArrayFilter('discount', option.value);
              }}
            />
          </div>

          {/* Active Filter Tags */}
          <AnimatePresence>
            {activeFiltersCount > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800"
              >
                {filters.brand.map((brand) => (
                  <Badge
                    key={brand}
                    variant="secondary"
                    className="cursor-pointer gap-1 text-xs"
                    onClick={() => toggleArrayFilter('brand', brand)}
                  >
                    {brand}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
                {filters.ram.map((ram) => (
                  <Badge
                    key={ram}
                    variant="secondary"
                    className="cursor-pointer gap-1 text-xs"
                    onClick={() => toggleArrayFilter('ram', ram)}
                  >
                    {ram} RAM
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
                {filters.storage.map((storage) => (
                  <Badge
                    key={storage}
                    variant="secondary"
                    className="cursor-pointer gap-1 text-xs"
                    onClick={() => toggleArrayFilter('storage', storage)}
                  >
                    {storage}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
                {filters.displaySize.map((size) => (
                  <Badge
                    key={size}
                    variant="secondary"
                    className="cursor-pointer gap-1 text-xs"
                    onClick={() => toggleArrayFilter('displaySize', size)}
                  >
                    {size}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
                {filters.discount.map((d) => {
                  const label = discountOptions.find(o => o.value === d)?.label;
                  return label ? (
                    <Badge
                      key={d}
                      variant="secondary"
                      className="cursor-pointer gap-1 text-xs"
                      onClick={() => toggleArrayFilter('discount', d)}
                    >
                      {label}
                      <X className="w-3 h-3" />
                    </Badge>
                  ) : null;
                })}
                {(filters.priceRange[0] > 0 || filters.priceRange[1] < 10000000) && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer gap-1 text-xs"
                    onClick={() => updateFilter('priceRange', [0, 10000000])}
                  >
                    {filters.priceRange[0].toLocaleString()}~{filters.priceRange[1].toLocaleString()}원
                    <X className="w-3 h-3" />
                  </Badge>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
