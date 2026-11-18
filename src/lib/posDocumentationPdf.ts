import jsPDF from "jspdf";

interface PosDocumentationOptions {
  propertyName?: string;
  baseUrl?: string;
}

export function generatePosDocumentationPdf(options: PosDocumentationOptions = {}) {
  const { 
    propertyName = "Your Property", 
    baseUrl = "https://xavsdfewzwdonndfcehh.supabase.co/functions/v1/pos-api" 
  } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  const addHeader = () => {
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("RoomMaster POS Integration API", margin, yPos);
    yPos += 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Documentation for ${propertyName}`, margin, yPos);
    doc.setTextColor(0);
    yPos += 15;
  };

  const addSection = (title: string) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 102, 204);
    doc.text(title, margin, yPos);
    doc.setTextColor(0);
    yPos += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };

  const addParagraph = (text: string) => {
    const lines = doc.splitTextToSize(text, contentWidth);
    if (yPos + lines.length * 5 > 280) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(lines, margin, yPos);
    yPos += lines.length * 5 + 3;
  };

  const addCode = (code: string) => {
    doc.setFont("courier", "normal");
    doc.setFillColor(245, 245, 245);
    const lines = doc.splitTextToSize(code, contentWidth - 10);
    const boxHeight = lines.length * 5 + 6;
    
    if (yPos + boxHeight > 280) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.rect(margin, yPos - 3, contentWidth, boxHeight, "F");
    doc.setFontSize(9);
    doc.text(lines, margin + 5, yPos + 2);
    yPos += boxHeight + 3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };

  const addTable = (headers: string[], rows: string[][]) => {
    const colWidth = contentWidth / headers.length;
    
    if (yPos + 20 > 280) {
      doc.addPage();
      yPos = 20;
    }

    // Header
    doc.setFillColor(0, 102, 204);
    doc.rect(margin, yPos - 4, contentWidth, 8, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    headers.forEach((header, i) => {
      doc.text(header, margin + i * colWidth + 2, yPos);
    });
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    yPos += 8;

    // Rows
    rows.forEach((row, rowIndex) => {
      if (yPos > 275) {
        doc.addPage();
        yPos = 20;
      }
      if (rowIndex % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPos - 4, contentWidth, 7, "F");
      }
      row.forEach((cell, i) => {
        const lines = doc.splitTextToSize(cell, colWidth - 4);
        doc.text(lines[0] || "", margin + i * colWidth + 2, yPos);
      });
      yPos += 7;
    });
    yPos += 5;
  };

  // Page 1: Title and Overview
  addHeader();

  addSection("Overview");
  addParagraph(
    "The RoomMaster POS Integration API enables Point-of-Sale systems to look up in-house guests by room number, " +
    "retrieve F&B account mappings with POS-specific codes, and post charges directly to guest folios."
  );

  addSection("Base URL");
  addCode(baseUrl);

  addSection("Authentication");
  addParagraph(
    "All API requests require an API key in the x-api-key header. Contact your property administrator to obtain an API key with the required scopes."
  );
  addCode("x-api-key: rm_xxxxxxxxxxxxxxxx");

  addSection("Required Scopes");
  addTable(
    ["Endpoint", "Required Scope"],
    [
      ["GET /rooms/{room}", "pos:read"],
      ["GET /accounts", "pos:write"],
      ["POST /postings", "pos:write"],
    ]
  );

  addSection("Rate Limits");
  addParagraph("Default rate limit is 60 requests per minute per API key. This can be configured by your property administrator.");

  // Page 2: Endpoints
  doc.addPage();
  yPos = 20;

  addSection("Endpoint 1: Room Lookup");
  addParagraph("Look up an in-house guest by room number.");
  addCode("GET /pos-api/rooms/{room_number}");
  addParagraph("Success Response (200):");
  addCode(
    '{\n  "success": true,\n  "guest_name": "John Smith",\n  "folio_id": "uuid...",\n  ' +
    '"reservation_id": "uuid...",\n  "check_in_date": "2026-01-10",\n  ' +
    '"check_out_date": "2026-01-15",\n  "current_balance": 245.50\n}'
  );

  addSection("Endpoint 2: Account List");
  addParagraph("Retrieve all F&B revenue accounts with their POS code mappings.");
  addCode("GET /pos-api/accounts");
  addParagraph("Success Response (200):");
  addCode(
    '{\n  "success": true,\n  "accounts": [\n    {\n      "id": "uuid...",\n      ' +
    '"code": "2000",\n      "name": "Restaurant Revenue",\n      "pos_code": "POS_RESTAURANT"\n    }\n  ]\n}'
  );

  // Page 3: Post Charge
  doc.addPage();
  yPos = 20;

  addSection("Endpoint 3: Post Charge");
  addParagraph("Post a charge to a guest's folio.");
  addCode("POST /pos-api/postings");
  addParagraph("Request Body:");
  addCode(
    '{\n  "room_number": "101",\n  "pos_code": "POS_RESTAURANT",\n  "amount": 45.50,\n  ' +
    '"description": "Dinner - Table 12",\n  "check_number": "CK#123456",\n  ' +
    '"pos_transaction_id": "POS-2026-00001"\n}'
  );

  addParagraph("Request Fields:");
  addTable(
    ["Field", "Required", "Description"],
    [
      ["room_number", "Yes", "Guest's room number"],
      ["pos_code", "Yes", "POS code mapped to revenue account"],
      ["amount", "Yes", "Charge amount (positive number)"],
      ["description", "Yes", "Charge description"],
      ["check_number", "No", "POS check/ticket number"],
      ["pos_transaction_id", "No", "Unique POS transaction ID"],
    ]
  );

  addParagraph("Success Response (200):");
  addCode(
    '{\n  "success": true,\n  "posting_id": "uuid...",\n  "guest_name": "John Smith",\n  ' +
    '"new_balance": 291.00,\n  "message": "Charge of $45.50 posted successfully"\n}'
  );

  // Page 4: Error Handling
  doc.addPage();
  yPos = 20;

  addSection("Error Handling");
  addParagraph("HTTP Status Codes:");
  addTable(
    ["Code", "Meaning", "Description"],
    [
      ["200", "Success", "Request completed successfully"],
      ["400", "Bad Request", "Invalid request body or parameters"],
      ["401", "Unauthorized", "Missing or invalid API key"],
      ["403", "Forbidden", "API key lacks required scope"],
      ["404", "Not Found", "Resource not found"],
      ["429", "Too Many Requests", "Rate limit exceeded"],
      ["500", "Server Error", "Unexpected server error"],
    ]
  );

  addParagraph("Error Response Format:");
  addCode('{\n  "success": false,\n  "error": "Human-readable error message"\n}');

  // Page 5: Best Practices
  doc.addPage();
  yPos = 20;

  addSection("Best Practices");
  
  addParagraph("1. Cache Account Mappings");
  addParagraph(
    "Fetch account mappings once at POS startup and refresh periodically (e.g., every hour). " +
    "This reduces API calls and improves performance."
  );

  addParagraph("2. Always Verify Room First");
  addParagraph(
    "Before posting charges, always call the room lookup endpoint to verify the guest is in-house. " +
    "Display the guest name for confirmation before posting."
  );

  addParagraph("3. Store Posting IDs");
  addParagraph(
    "Always store the posting_id from successful charges for end-of-day reconciliation, " +
    "dispute resolution, and audit trails."
  );

  addParagraph("4. Use Unique Transaction IDs");
  addParagraph(
    "Generate unique pos_transaction_id values for each transaction to enable easy reconciliation " +
    "and prevent duplicate postings."
  );

  addParagraph("5. Handle Errors Gracefully");
  addParagraph(
    "Implement proper error handling for all API responses. Show user-friendly messages and " +
    "provide fallback options when the API is unavailable."
  );

  // Page 6: Testing Checklist
  doc.addPage();
  yPos = 20;

  addSection("Testing Checklist");
  
  addParagraph("Pre-Production Testing:");
  const checklistItems = [
    "□ Valid API key returns expected data",
    "□ Invalid/missing API key returns 401",
    "□ In-house guest room lookup works",
    "□ Empty room returns 404",
    "□ All mapped accounts are returned",
    "□ Valid charge posts successfully",
    "□ Posting ID is returned and stored",
    "□ Balance updates correctly",
    "□ Invalid POS code returns 400",
    "□ Invalid room returns 404",
    "□ Error messages display correctly",
  ];
  checklistItems.forEach(item => {
    addParagraph(item);
  });

  addSection("Go-Live Checklist");
  const goLiveItems = [
    "□ API key with correct scopes obtained",
    "□ Base URL configured correctly",
    "□ Account mappings verified",
    "□ Test charges posted and voided",
    "□ Reconciliation process documented",
  ];
  goLiveItems.forEach(item => {
    addParagraph(item);
  });

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `RoomMaster POS Integration API v1.0 - Page ${i} of ${pageCount}`,
      margin,
      290
    );
    doc.text(
      `Generated: ${new Date().toLocaleDateString()}`,
      pageWidth - margin - 40,
      290
    );
  }

  return doc;
}

export function downloadPosDocumentation(propertyName?: string) {
  try {
    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pos-api`;
    const doc = generatePosDocumentationPdf({ propertyName, baseUrl });
    doc.save("RoomMaster_POS_API_Documentation.pdf");
    return true;
  } catch (error) {
    console.error("Failed to generate POS documentation:", error);
    return false;
  }
}
