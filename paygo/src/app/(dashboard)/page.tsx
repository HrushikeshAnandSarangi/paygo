"use client"

import { useState, useCallback } from "react"
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  FileText,
  RefreshCw,
  Settings,
  Download,
  Clock,
  Flag,
  CalendarDays,
  DollarSign,
} from "lucide-react"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line } from "recharts"

// Sample invoice data based on your JSON structure
const sampleInvoices = [
  {
    id: "INV-001",
    invoice_number: { value: "F1000876/23", confidence: 0.966 },
    vendor_name: { value: "Tech Solutions Corp", confidence: 0.892 },
    invoice_date: { value: "2023-08-14", confidence: 0.966 },
    total_amount: { value: 702.0, confidence: 0.95 },
    currency: { value: "USD", confidence: 0.8 },
    purchase_order: { value: "X001525", confidence: 0.535 },
    due_date: { value: "2023-09-14", confidence: 0.88 },
    gst_number: { value: "22AAAAA0000A1Z5", confidence: 0.75 },
    tax_amount: { value: 117.0, confidence: 0.957 },
    status: "completed"
  },
  {
    id: "INV-002",
    invoice_number: { value: "INV-2024-1045", confidence: 0.95 },
    vendor_name: { value: "Global Supply Inc", confidence: 0.391 },
    invoice_date: { value: "2023-08-15", confidence: 0.97 },
    total_amount: { value: 1250.0, confidence: 0.92 },
    currency: { value: "USD", confidence: 0.85 },
    purchase_order: { value: "X001526", confidence: 0.445 },
    due_date: { value: "nil", confidence: 0.0 },
    gst_number: { value: "nil", confidence: 0.0 },
    tax_amount: { value: 208.33, confidence: 0.88 },
    status: "flagged"
  },
  {
    id: "INV-003",
    invoice_number: { value: "TS-5432", confidence: 0.98 },
    vendor_name: { value: "Office Supplies Ltd", confidence: 0.96 },
    invoice_date: { value: "2023-08-16", confidence: 0.99 },
    total_amount: { value: 450.0, confidence: 0.97 },
    currency: { value: "USD", confidence: 0.9 },
    purchase_order: { value: "X001527", confidence: 0.82 },
    due_date: { value: "2023-09-16", confidence: 0.95 },
    gst_number: { value: "27BBBBB1111B1Z5", confidence: 0.89 },
    tax_amount: { value: 75.0, confidence: 0.96 },
    status: "completed"
  },
  {
    id: "INV-004",
    invoice_number: { value: "CS-2024-8901", confidence: 0.88 },
    vendor_name: { value: "Cloud Services", confidence: 0.425 },
    invoice_date: { value: "2023-08-17", confidence: 0.92 },
    total_amount: { value: 2100.0, confidence: 0.94 },
    currency: { value: "USD", confidence: 0.87 },
    purchase_order: { value: "nil", confidence: 0.0 },
    due_date: { value: "2023-09-17", confidence: 0.91 },
    gst_number: { value: "nil", confidence: 0.0 },
    tax_amount: { value: 350.0, confidence: 0.93 },
    status: "flagged"
  },
  {
    id: "INV-005",
    invoice_number: { value: "AC-789", confidence: 0.99 },
    vendor_name: { value: "Acme Corporation", confidence: 0.97 },
    invoice_date: { value: "2023-08-18", confidence: 0.98 },
    total_amount: { value: 890.0, confidence: 0.96 },
    currency: { value: "USD", confidence: 0.92 },
    purchase_order: { value: "X001528", confidence: 0.78 },
    due_date: { value: "2023-09-18", confidence: 0.94 },
    gst_number: { value: "29CCCCC2222C1Z5", confidence: 0.91 },
    tax_amount: { value: 148.33, confidence: 0.95 },
    status: "completed"
  },
  {
    id: "INV-006",
    invoice_number: { value: "GS-456", confidence: 0.72 },
    vendor_name: { value: "COMPANY", confidence: 0.358 },
    invoice_date: { value: "2023-08-19", confidence: 0.85 },
    total_amount: { value: 1580.0, confidence: 0.79 },
    currency: { value: "USD", confidence: 0.75 },
    purchase_order: { value: "X001529", confidence: 0.512 },
    due_date: { value: "nil", confidence: 0.0 },
    gst_number: { value: "nil", confidence: 0.0 },
    tax_amount: { value: 263.33, confidence: 0.82 },
    status: "flagged"
  },
]

const processingTrendData = [
  { date: "Mon", processed: 45, flagged: 3 },
  { date: "Tue", processed: 52, flagged: 5 },
  { date: "Wed", processed: 48, flagged: 2 },
  { date: "Thu", processed: 61, flagged: 6 },
  { date: "Fri", processed: 58, flagged: 4 },
  { date: "Sat", processed: 35, flagged: 2 },
  { date: "Sun", processed: 28, flagged: 1 },
]

export default function InvoiceDashboard() {
  const [invoices, setInvoices] = useState(sampleInvoices)
  const [activeTab, setActiveTab] = useState("all")
  const [isLoading, setIsLoading] = useState(false)

  // Calculate metrics
  const totalProcessed = invoices.length
  const flaggedInvoices = invoices.filter(inv => inv.status === "flagged")
  const totalFlagged = flaggedInvoices.length
  
  const calculateAvgConfidence = () => {
    const fields = ['invoice_number', 'vendor_name', 'invoice_date', 'total_amount', 'tax_amount'] as const
    type FieldKey = typeof fields[number]
    
    let totalConfidence = 0
    let count = 0
    
    invoices.forEach(inv => {
      fields.forEach(field => {
        const value = inv[field as keyof typeof inv]
        if (typeof value === 'object' && value !== null && 'confidence' in value && value.confidence > 0) {
          totalConfidence += value.confidence * 100
          count++
        }
      })
    })
    
    return count > 0 ? (totalConfidence / count).toFixed(1) : 0
  }

  const avgConfidence = calculateAvgConfidence()

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.total_amount.value, 0)
  const totalTax = invoices.reduce((sum, inv) => sum + inv.tax_amount.value, 0)

  const filteredInvoices = activeTab === "flagged" ? flaggedInvoices : invoices

  const handleRefresh = useCallback(async () => {
    setIsLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // In real app, fetch new data here
    } catch (error) {
      console.error("Failed to refresh")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600"
    if (confidence >= 0.75) return "text-yellow-600"
    return "text-red-600"
  }

  const getConfidenceBgColor = (confidence: number) => {
    if (confidence >= 0.9) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    if (confidence >= 0.75) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  }

  // Amount distribution over time
  const amountTrendData = invoices.map((inv, idx) => ({
    invoice: inv.invoice_number.value.substring(0, 10),
    amount: inv.total_amount.value,
    tax: inv.tax_amount.value,
  })).slice(0, 6)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Invoice Processing Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">AI-powered invoice data extraction with confidence scoring</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 h-9 px-3 text-gray-900 dark:text-white"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 h-9 px-3 text-gray-900 dark:text-white">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 h-9 px-3 text-gray-900 dark:text-white">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {/* Total Invoices */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-blue-100">Total Invoices</h3>
              <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                <FileText className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-4xl font-bold text-white mb-2">{totalProcessed}</div>
            <div className="flex items-center text-xs text-blue-100">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              Processed successfully
            </div>
          </div>
        </div>

        {/* Flagged for Review */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-orange-100">Flagged for Review</h3>
              <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                <Flag className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-4xl font-bold text-white mb-2">{totalFlagged}</div>
            <div className="flex items-center text-xs text-orange-100">
              <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
              Low confidence fields
            </div>
          </div>
        </div>

        {/* Avg Confidence */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 via-green-600 to-green-700 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-green-100">Avg Confidence</h3>
              <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-4xl font-bold text-white mb-2">{avgConfidence}%</div>
            <div className="flex items-center text-xs text-green-100">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              Extraction accuracy
            </div>
          </div>
        </div>

        {/* Total Amount */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-purple-100">Total Amount</h3>
              <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center text-xs text-purple-100">
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              Total invoice value
            </div>
          </div>
        </div>

        {/* Total Tax */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-indigo-100">Total Tax</h3>
              <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              ${totalTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center text-xs text-indigo-100">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              Tax component
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        {/* Processing Trend - Full Width */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6 pb-4">
            <h3 className="text-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-white">
              Weekly Processing Trend
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Invoice processing activity by day</p>
          </div>
          <div className="px-6 pb-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={processingTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
                <XAxis dataKey="date" className="text-gray-600 dark:text-gray-400" />
                <YAxis className="text-gray-600 dark:text-gray-400" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="processed" stackId="a" fill="#3b82f6" name="Processed" />
                <Bar dataKey="flagged" stackId="a" fill="#f59e0b" name="Flagged" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Amount Trend Chart */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-card-foreground shadow-sm mb-8">
        <div className="flex flex-col space-y-1.5 p-6 pb-4">
          <h3 className="text-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-white">
            Invoice Amount Trend
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total amount and tax breakdown by invoice</p>
        </div>
        <div className="px-6 pb-6">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={amountTrendData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
              <XAxis dataKey="invoice" className="text-gray-600 dark:text-gray-400" />
              <YAxis className="text-gray-600 dark:text-gray-400" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} name="Total Amount" />
              <Line type="monotone" dataKey="tax" stroke="#10b981" strokeWidth={2} name="Tax Amount" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-card-foreground shadow-sm mb-8">
        <div className="flex flex-col space-y-1.5 p-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-white">
                Processed Invoices
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Extracted invoice data with confidence scores</p>
            </div>
            <div className="inline-flex h-10 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700 p-1 text-gray-500 dark:text-gray-400">
              <button
                onClick={() => setActiveTab("all")}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                  activeTab === "all"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                All ({invoices.length})
              </button>
              <button
                onClick={() => setActiveTab("flagged")}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                  activeTab === "flagged"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                Flagged ({totalFlagged})
              </button>
            </div>
          </div>
        </div>
        <div className="px-6 pb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-white">Invoice #</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-white">Vendor</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-white">Date</th>
                  <th className="text-right p-3 text-sm font-semibold text-gray-900 dark:text-white">Amount</th>
                  <th className="text-right p-3 text-sm font-semibold text-gray-900 dark:text-white">Tax</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-900 dark:text-white">PO Number</th>
                  <th className="text-center p-3 text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {invoice.invoice_number.value}
                        </span>
                        <span className={`text-xs ${getConfidenceColor(invoice.invoice_number.confidence)}`}>
                          {(invoice.invoice_number.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {invoice.vendor_name.value}
                        </span>
                        <span className={`text-xs ${getConfidenceColor(invoice.vendor_name.confidence)}`}>
                          {(invoice.vendor_name.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {invoice.invoice_date.value !== "nil" ? new Date(invoice.invoice_date.value).toLocaleDateString() : "N/A"}
                        </span>
                        <span className={`text-xs ${getConfidenceColor(invoice.invoice_date.confidence)}`}>
                          {(invoice.invoice_date.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          ${invoice.total_amount.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-xs ${getConfidenceColor(invoice.total_amount.confidence)}`}>
                          {(invoice.total_amount.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm text-gray-900 dark:text-white">
                          ${invoice.tax_amount.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`text-xs ${getConfidenceColor(invoice.tax_amount.confidence)}`}>
                          {(invoice.tax_amount.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {invoice.purchase_order.value !== "nil" ? invoice.purchase_order.value : "N/A"}
                        </span>
                        {invoice.purchase_order.value !== "nil" && (
                          <span className={`text-xs ${getConfidenceColor(invoice.purchase_order.confidence)}`}>
                            {(invoice.purchase_order.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {invoice.status === "flagged" ? (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          <Flag className="h-3 w-3 mr-1" />
                          Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detailed Field View for Flagged Items */}
      {activeTab === "flagged" && flaggedInvoices.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-card-foreground shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6 pb-4">
            <h3 className="text-2xl font-semibold leading-none tracking-tight text-gray-900 dark:text-white">
              Flagged Invoice Details
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Complete field extraction with confidence scores</p>
          </div>
          <div className="px-6 pb-6">
            <div className="space-y-6">
              {flaggedInvoices.map((invoice) => (
                <div key={invoice.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
                    {invoice.vendor_name.value} - {invoice.invoice_number.value}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(invoice)
                      .filter(([key]) => !['id', 'status'].includes(key))
                      .map(([key, data]) => (
                        <div key={key} className="flex flex-col p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase mb-1">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {typeof data === 'object' && 'value' in data ? (data.value === "nil" ? "N/A" : data.value) : data}
                            </span>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${typeof data === 'object' && 'confidence' in data ? getConfidenceBgColor(data.confidence) : ''}`}>
                              {typeof data === 'object' && 'confidence' in data ? (data.confidence * 100).toFixed(0) : 'N/A'}%
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}