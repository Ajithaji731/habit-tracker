// Retrieve the secure ID from Script Properties
var SECURE_ID = PropertiesService.getScriptProperties().getProperty('SECURE_ID');

function doGet(e) {
  var userId = e.parameter.userId;
  
  if (!userId) {
    return createJsonResponse({error: "userId is required"});
  }
  
  // SECURITY CHECK
  if (userId !== SECURE_ID) {
    return createJsonResponse({error: "Unauthorized"});
  }
  
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == userId) {
      // Data found
      var habitsStr = data[i][1];
      if (!habitsStr) habitsStr = "[]";
      return ContentService.createTextOutput(habitsStr)
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // New user, return empty array
  return ContentService.createTextOutput(JSON.stringify([]))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var postData = JSON.parse(e.postData.contents);
    var userId = postData.userId;
    var habitsData = JSON.stringify(postData.habits);
    
    if (!userId) {
      return createJsonResponse({error: "userId is required"});
    }
    
    // SECURITY CHECK
    if (userId !== SECURE_ID) {
      return createJsonResponse({error: "Unauthorized"});
    }
    
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    var found = false;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == userId) {
        sheet.getRange(i + 1, 2).setValue(habitsData);
        found = true;
        break;
      }
    }
    
    if (!found) {
      sheet.appendRow([userId, habitsData]);
    }
    
    return createJsonResponse({success: true});
  } catch (err) {
    return createJsonResponse({error: err.toString()});
  }
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Data");
  if (!sheet) {
    sheet = ss.insertSheet("Data");
    sheet.appendRow(["UserId", "Data"]); // Headers
  }
  return sheet;
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
