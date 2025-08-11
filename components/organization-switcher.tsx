"use client"

import { useState, useRef, useEffect } from "react"
import { Check, ChevronDown, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Organization {
  id: string
  name: string
  isAdmin: boolean
  joinedAt: string
  isCurrent?: boolean
}

interface OrganizationSwitcherProps {
  currentOrganization: Organization | null
  organizations: Organization[]
  onSwitch: (organizationId: string) => void
}

export function OrganizationSwitcher({
  currentOrganization,
  organizations,
  onSwitch,
}: OrganizationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Don't show switcher if user only has one organization
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (organizations.length <= 1) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="justify-between min-w-[200px] bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
      >
        <div className="flex items-center space-x-2">
          <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="truncate text-sm font-medium">
            {currentOrganization?.name || "Select organization"}
          </span>
        </div>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md shadow-lg z-50">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => {
                if (org.id !== currentOrganization?.id) {
                  onSwitch(org.id)
                }
                setIsOpen(false)
              }}
              className="w-full flex items-center justify-between py-2 px-3 hover:bg-gray-50 dark:hover:bg-zinc-700 first:rounded-t-md last:rounded-b-md"
            >
              <div className="flex items-center space-x-2 flex-1">
                <Building2 className="h-4 w-4 text-gray-500" />
                <div className="flex flex-col text-left">
                  <span className="truncate text-sm font-medium">{org.name}</span>
                  {org.isAdmin && (
                    <span className="text-xs text-blue-600 dark:text-blue-400">Admin</span>
                  )}
                </div>
              </div>
              {org.isCurrent && (
                <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
