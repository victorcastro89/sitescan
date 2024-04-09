// Define the pattern to test against
const hostingPatterns = [
    {
      "Hosting": "Hostgator",
      "regex": "locaweb",
      "DNS": "\\parking\\.*"
    }
  ];
  
  // The concatenated string to test
  const concatenatedString = "carrielle.com.br,ns2.dns-parking.com,ns1.dns-parking.com,mx1.hostinger.com (Priority: 5),mx2.hostinger.com (Priority: 10),154.56.48.147";
  
  // The code block you provided to test
  let hostingName = 'Unknown'; // Default value if no match is found
  for (const pattern of hostingPatterns) {
      const dnsRegex = new RegExp(pattern.DNS, 'i');
      const regex = new RegExp(pattern.regex, 'i');
      if (dnsRegex.test(concatenatedString) || regex.test(concatenatedString)) {
          hostingName = pattern.Hosting;
          break; // Stop searching after the first match
      }
  }
  
  // Check if the hostingName is correctly identified
  console.log(`Hosting Name Identified: ${hostingName}`);
  
  // Assert the result (simple assertion)
  if (hostingName === "Hostgator") {
      console.log("Test Passed: Hosting name correctly identified as Hostgator.");
  } else {
      console.log("Test Failed: Hosting name was not correctly identified.");
  }
  