"use client"

import { useState } from "react"
import {
  Upload,
  FileText,
  Download,
  CheckCircle,
  AlertCircle,
  Code,
  Table as TableIcon,
  BarChart3,
  Loader2,
  X,
  File,
  ChevronDown,
  Flag,
  AlertTriangle,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import * as XLSX from "xlsx"

interface ExtractedDataItem {
  value: string;
  confidence: number;
}

interface ExtractedData {
  [key: string]: ExtractedDataItem;
}

interface FlagReason {
  rule: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

interface InvoiceFlags {
  isFlagged: boolean;
  reasons: FlagReason[];
}

export default function FileExtractor() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showRawJson, setShowRawJson] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState("both")
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [invoiceFlags, setInvoiceFlags] = useState<InvoiceFlags | null>(null)

  /**
   * Custom Flagging Rules for Invoices
   */
  const applyFlaggingRules = (data: ExtractedData): InvoiceFlags => {
    const reasons: FlagReason[] = []

    // Rule 1: Flag if average confidence score across all fields is below 50%
    const confidences = Object.values(data).map(item => item.confidence)
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length
    if (avgConfidence < 0.5) {
      reasons.push({
        rule: 'LOW_CONFIDENCE',
        severity: 'high',
        message: `Average confidence score (${(avgConfidence * 100).toFixed(1)}%) is below 50%. Manual verification recommended.`
      })
    }

    // Rule 2: Flag if total amount exceeds $100,000
    const totalAmount = parseFloat(data.total_amount?.value || '0')
    if (totalAmount > 100000) {
      reasons.push({
        rule: 'HIGH_VALUE',
        severity: 'medium',
        message: `Invoice amount ($${totalAmount.toLocaleString()}) exceeds $100,000 threshold. Requires approval.`
      })
    }

    // Rule 3: Flag if due date is within 7 days or overdue
    if (data.due_date?.value && data.due_date.value !== 'nil') {
      try {
        const dueDate = new Date(data.due_date.value)
        const today = new Date()
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysUntilDue < 0) {
          reasons.push({
            rule: 'OVERDUE',
            severity: 'high',
            message: `Invoice is overdue by ${Math.abs(daysUntilDue)} day(s). Immediate action required.`
          })
        } else if (daysUntilDue <= 7) {
          reasons.push({
            rule: 'DUE_SOON',
            severity: 'medium',
            message: `Invoice due in ${daysUntilDue} day(s). Payment should be processed soon.`
          })
        }
      } catch (e) {
        console.error('Error parsing due date:', e)
      }
    }

    // Rule 4: Flag if critical fields are missing
    const criticalFields = ['invoice_number', 'vendor_name', 'total_amount', 'invoice_date']
    const missingCriticalFields = criticalFields.filter(field => 
      !data[field]?.value || data[field].value === 'nil'
    )
    if (missingCriticalFields.length > 0) {
      reasons.push({
        rule: 'MISSING_CRITICAL_DATA',
        severity: 'high',
        message: `Missing critical fields: ${missingCriticalFields.join(', ')}. Invoice cannot be processed automatically.`
      })
    }

    // Rule 5: Flag if tax amount seems inconsistent
    if (data.tax_amount?.value && totalAmount > 0) {
      const taxAmount = parseFloat(data.tax_amount.value)
      const taxPercentage = (taxAmount / totalAmount) * 100
      if (taxPercentage < 5 || taxPercentage > 20) {
        reasons.push({
          rule: 'UNUSUAL_TAX',
          severity: 'low',
          message: `Tax amount (${taxPercentage.toFixed(1)}%) appears unusual. Expected range: 5-20%.`
        })
      }
    }

    // Rule 6: Flag potential test/duplicate invoices
    if (data.invoice_number?.value && data.invoice_number.value.toLowerCase().includes('test')) {
      reasons.push({
        rule: 'POTENTIAL_TEST_INVOICE',
        severity: 'low',
        message: 'Invoice number contains "test" - verify this is not a test or duplicate invoice.'
      })
    }

    return {
      isFlagged: reasons.length > 0,
      reasons: reasons.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 }
        return severityOrder[a.severity] - severityOrder[b.severity]
      })
    }
  }

  const processInvoice = async (selectedFile: File) => {
    setIsProcessing(true)
    setError(null)
    setExtractedData(null)
    setInvoiceFlags(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await fetch("https://paygoapi-crc3gkhjd6bqchhm.centralindia-01.azurewebsites.net/process-invoice", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Failed to process invoice: ${response.statusText}`)
      }

      const result = await response.json()
      const data = result.data || result
      setExtractedData(data)

      // Apply flagging rules
      const flags = applyFlaggingRules(data)
      setInvoiceFlags(flags)

      // Save to database with flagging information
      await saveToDatabase(data, flags)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while processing the invoice")
      console.error("Error:", err)
    } finally {
      setIsProcessing(false)
    }
  }

  const saveToDatabase = async (data: ExtractedData, flags: InvoiceFlags) => {
    try {
      const userUuid = localStorage.getItem('user_uuid')
      
      if (!userUuid) {
        console.error('user_uuid not found in localStorage')
        return
      }

      // Convert extracted data to the mail schema format with flagging
      const mailData = {
        user_uuid: userUuid,
        scraped_data: JSON.stringify(data),
        invoice_number: data.invoice_number?.value || "N/A",
        vendor_name: data.vendor_name?.value || "N/A",
        invoice_date: data.invoice_date?.value || new Date().toISOString(),
        total_amount: parseFloat(data.total_amount?.value) || 0,
        purchase_order: data.purchase_order?.value === "nil" ? undefined : data.purchase_order?.value,
        due_date: data.due_date?.value === "nil" ? undefined : data.due_date?.value,
        gst_number: data.gst_number?.value === "nil" ? undefined : data.gst_number?.value,
        tax_amount: data.tax_amount?.value ? parseFloat(data.tax_amount.value) : undefined,
        flagged: flags.isFlagged,
      }

      console.log('[FileExtractor] - Sending mail data to database:', mailData)

      const dbResponse = await fetch('/api/mails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mailData),
      })

      if (!dbResponse.ok) {
        const errorData = await dbResponse.json()
        throw new Error(errorData.error || 'Failed to save to database')
      }

      const savedMail = await dbResponse.json()
      console.log('[FileExtractor] - Successfully saved to database:', savedMail)
    } catch (err) {
      console.error('[FileExtractor] - Error saving to database:', err)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const selectedFile = files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      processInvoice(selectedFile)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      setError(null)
      processInvoice(droppedFile)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600 dark:text-green-400"
    if (confidence >= 0.75) return "text-yellow-600 dark:text-yellow-400"
    return "text-red-600 dark:text-red-400"
  }

  const getConfidenceBgColor = (confidence: number) => {
    if (confidence >= 0.9) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    if (confidence >= 0.75) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  }

  const getConfidenceBarColor = (confidence: number) => {
    if (confidence >= 0.9) return "#10b981"
    if (confidence >= 0.75) return "#f59e0b"
    return "#ef4444"
  }

  const getSeverityColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    }
  }

  const downloadJson = () => {
    if (!extractedData) return
    const dataStr = JSON.stringify(extractedData, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = "extracted-invoice-data.json"
    link.click()
    URL.revokeObjectURL(url)
    setShowDownloadMenu(false)
  }

  const downloadTxt = () => {
    if (!extractedData) return
    
    let txtContent = "EXTRACTED INVOICE DATA\n"
    txtContent += "=".repeat(50) + "\n\n"
    
    Object.entries(extractedData).forEach(([key, data]) => {
      const fieldName = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
      txtContent += `${fieldName}:\n`
      txtContent += `  Value: ${data.value}\n`
      txtContent += `  Confidence: ${(data.confidence * 100).toFixed(1)}%\n\n`
    })
    
    if (invoiceFlags && invoiceFlags.isFlagged) {
      txtContent += "\n" + "=".repeat(50) + "\n"
      txtContent += "FLAGGED ISSUES\n"
      txtContent += "=".repeat(50) + "\n\n"
      invoiceFlags.reasons.forEach((reason, idx) => {
        txtContent += `${idx + 1}. [${reason.severity.toUpperCase()}] ${reason.message}\n\n`
      })
    }
    
    const dataBlob = new Blob([txtContent], { type: "text/plain" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = "extracted-invoice-data.txt"
    link.click()
    URL.revokeObjectURL(url)
    setShowDownloadMenu(false)
  }

  const downloadCsv = () => {
    if (!extractedData) return
    
    let csvContent = "Field Name,Extracted Value,Confidence Score (%),Status\n"
    
    Object.entries(extractedData).forEach(([key, data]) => {
      const fieldName = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
      const value = data.value === "nil" ? "Not Available" : data.value
      const confidence = (data.confidence * 100).toFixed(1)
      const status = data.confidence >= 0.9 ? "High" : data.confidence >= 0.75 ? "Medium" : "Low"
      
      const escapedValue = value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value
      
      csvContent += `${fieldName},${escapedValue},${confidence},${status}\n`
    })
    
    const dataBlob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = "extracted-invoice-data.csv"
    link.click()
    URL.revokeObjectURL(url)
    setShowDownloadMenu(false)
  }

  const downloadXlsx = () => {
    if (!extractedData) return
    
    const excelData = Object.entries(extractedData).map(([key, data]) => ({
      "Field Name": key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      "Extracted Value": data.value === "nil" ? "Not Available" : data.value,
      "Confidence Score (%)": (data.confidence * 100).toFixed(1),
      "Status": data.confidence >= 0.9 ? "High" : data.confidence >= 0.75 ? "Medium" : "Low"
    }))
    
    const worksheet = XLSX.utils.json_to_sheet(excelData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Extracted Data")
    
    worksheet['!cols'] = [
      { wch: 25 },
      { wch: 30 },
      { wch: 20 },
      { wch: 15 }
    ]
    
    XLSX.writeFile(workbook, "extracted-invoice-data.xlsx")
    setShowDownloadMenu(false)
  }

  const removeFile = () => {
    setFile(null)
    setExtractedData(null)
    setError(null)
    setInvoiceFlags(null)
  }

  const chartData = extractedData
    ? Object.entries(extractedData).map(([key, data]) => ({
        field: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        confidence: parseFloat((data.confidence * 100).toFixed(1)),
        confidenceValue: data.confidence,
      }))
    : []

  const calculateStats = () => {
    if (!extractedData) return null

    const confidences = Object.values(extractedData).map((d) => d.confidence)
    const avgConfidence = (confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100
    const highConfidence = confidences.filter((c) => c >= 0.9).length
    const mediumConfidence = confidences.filter((c) => c >= 0.75 && c < 0.9).length
    const lowConfidence = confidences.filter((c) => c < 0.75).length

    return {
      avg: avgConfidence.toFixed(1),
      high: highConfidence,
      medium: mediumConfidence,
      low: lowConfidence,
      total: confidences.length,
    }
  }

  const stats = calculateStats()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Invoice Data Extractor</h1>
          <p className="text-gray-600 dark:text-gray-300">Upload and automatically extract structured data from invoices</p>
        </div>
      </div>

      {/* File Upload Area */}
      <div className="max-w-7xl mx-auto mb-8">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-8 text-center transition-all hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-750 cursor-pointer"
        >
          <input
            type="file"
            onChange={handleFileChange}
            accept="image/*,.pdf"
            className="hidden"
            id="file-upload"
            disabled={isProcessing}
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Drop your invoice here or click to browse
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Supports PDF and image files</p>
          </label>

          {file && !isProcessing && (
            <div className="mt-4 inline-flex items-center bg-blue-100 dark:bg-blue-900 px-4 py-2 rounded-lg">
              <File className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-200">{file.name}</span>
              <button onClick={removeFile} className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Processing State */}
      {isProcessing && (
        <div className="max-w-7xl mx-auto mb-8">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-8 text-center">
            <Loader2 className="mx-auto h-12 w-12 text-blue-600 animate-spin mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Processing Invoice...</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Extracting data from your invoice. This may take a few moments.
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="max-w-7xl mx-auto mb-8">
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
              <h3 className="text-lg font-medium text-red-900 dark:text-red-200">Error Processing Invoice</h3>
            </div>
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Flagging Alert */}
      {invoiceFlags && invoiceFlags.isFlagged && (
        <div className="max-w-7xl mx-auto mb-8">
          <div className="rounded-lg border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 p-6">
            <div className="flex items-start">
              <Flag className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-200 mb-3">
                  Invoice Flagged for Review
                </h3>
                <div className="space-y-3">
                  {invoiceFlags.reasons.map((reason, idx) => (
                    <div key={idx} className="flex items-start bg-white dark:bg-gray-800 rounded-lg p-3">
                      <AlertTriangle className={`h-5 w-5 mr-3 mt-0.5 flex-shrink-0 ${
                        reason.severity === 'high' ? 'text-red-600' : 
                        reason.severity === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {reason.rule.replace(/_/g, ' ')}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getSeverityColor(reason.severity)}`}>
                            {reason.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{reason.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {extractedData && (
        <>
          {/* Statistics Cards */}
          {stats && (
            <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Average Confidence</div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.avg}%</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">High Confidence</div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.high}</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Medium Confidence</div>
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{stats.medium}</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Low Confidence</div>
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.low}</div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="max-w-7xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveView("both")}
                className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === "both"
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <TableIcon className="h-4 w-4 mr-2" />
                Both
              </button>
              <button
                onClick={() => setActiveView("table")}
                className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === "table"
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <TableIcon className="h-4 w-4 mr-2" />
                Table
              </button>
              <button
                onClick={() => setActiveView("charts")}
                className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === "charts"
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Charts
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Code className="h-4 w-4 mr-2" />
                {showRawJson ? "Hide" : "Show"} JSON
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                  className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                  <ChevronDown className="h-4 w-4 ml-2" />
                </button>
                
                {showDownloadMenu && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1">
                      <button
                        onClick={downloadJson}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                      >
                        <Code className="h-4 w-4 mr-2" />
                        Download as JSON
                      </button>
                      <button
                        onClick={downloadCsv}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                      >
                        <TableIcon className="h-4 w-4 mr-2" />
                        Download as CSV
                      </button>
                      <button
                        onClick={downloadXlsx}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Download as XLSX
                      </button>
                      <button
                        onClick={downloadTxt}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                      >
                        <File className="h-4 w-4 mr-2" />
                        Download as TXT
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Raw JSON Display */}
          {showRawJson && (
            <div className="max-w-7xl mx-auto mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Code className="h-5 w-5 mr-2" />
                Raw JSON Data
              </h2>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-green-400 font-mono">
                  {JSON.stringify(extractedData, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Table View */}
          {(activeView === "table" || activeView === "both") && (
            <div className="max-w-7xl mx-auto mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="p-6 pb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                  <TableIcon className="h-5 w-5 mr-2" />
                  Extracted Data Table
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Field Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Extracted Value
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Confidence Score
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {Object.entries(extractedData).map(([key, data]) => (
                      <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {data.value === "nil" ? (
                              <span className="text-gray-400 italic">Not Available</span>
                            ) : (
                              data.value
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex flex-col items-center">
                            <span className={`text-sm font-bold ${getConfidenceColor(data.confidence)}`}>
                              {(data.confidence * 100).toFixed(1)}%
                            </span>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                              <div
                                className="h-2 rounded-full transition-all"
                                style={{
                                  width: `${data.confidence * 100}%`,
                                  backgroundColor: getConfidenceBarColor(data.confidence),
                                }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConfidenceBgColor(
                              data.confidence
                            )}`}
                          >
                            {data.confidence >= 0.9 ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                High
                              </>
                            ) : data.confidence >= 0.75 ? (
                              <>
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Medium
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Low
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Charts View */}
          {(activeView === "charts" || activeView === "both") && (
            <div className="max-w-7xl mx-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Confidence Score Visualization
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
                  <XAxis
                    dataKey="field"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    className="text-gray-600 dark:text-gray-400"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    label={{ value: "Confidence Score (%)", angle: -90, position: "insideLeft" }}
                    className="text-gray-600 dark:text-gray-400"
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => [`${value}%`, "Confidence"]}
                  />
                  <Bar dataKey="confidence" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getConfidenceBarColor(entry.confidenceValue)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!extractedData && !isProcessing && (
        <div className="max-w-7xl mx-auto rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Data Extracted Yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Upload an invoice file to automatically extract and view structured data
          </p>
        </div>
      )}

      {showDownloadMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowDownloadMenu(false)}
        />
      )}
    </div>
  )
}