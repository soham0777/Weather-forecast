# SOAP Service Reference

> **EDUCATIONAL SIMULATOR — NOT A REAL BANKING SYSTEM.** SOAP is retained for existing legacy consumers such as ATM
> switches and branch software in this educational architecture.

| | |
|---|---|
| Endpoint | `POST http://localhost:8000/soap` |
| Contract | `GET http://localhost:8000/soap?wsdl` (WSDL 1.1) |
| Protocol | SOAP 1.1, document/literal wrapped |
| Content type | `text/xml; charset=utf-8` |
| SOAPAction | `http://bank.local/soap/corebanking/v1/{operation}` |
| Namespace (`ndb`) | `http://bank.local/soap/corebanking/v1` |
| Implementation | `backend/app/soap/service.py` (lxml) → `backend/app/services/banking_service.py` |

REST is resource-oriented (many URLs, HTTP verbs); SOAP is **operation-oriented**: every call is a POST to the same
URL and the XML body names the operation.

## Consumer header (optional)

Legacy consumers identify themselves in the SOAP header. It is used for logging and ledger narrations
(e.g. `ATM-FT/TRX10002/TO 9876543210`).

```xml
<soap:Header>
  <ndb:ConsumerInfo>
    <ndb:channel>ATM</ndb:channel>              <!-- ATM or BRANCH -->
    <ndb:terminalId>ATM-PUNE-0042</ndb:terminalId>
  </ndb:ConsumerInfo>
</soap:Header>
```

## getBalance

Request:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ndb="http://bank.local/soap/corebanking/v1">
  <soap:Header>
    <ndb:ConsumerInfo>
      <ndb:channel>ATM</ndb:channel>
      <ndb:terminalId>ATM-PUNE-0042</ndb:terminalId>
    </ndb:ConsumerInfo>
  </soap:Header>
  <soap:Body>
    <ndb:getBalance>
      <ndb:accountNumber>1234567890</ndb:accountNumber>
    </ndb:getBalance>
  </soap:Body>
</soap:Envelope>
```

Response (HTTP 200):

```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ndb="http://bank.local/soap/corebanking/v1">
  <soap:Body>
    <ndb:getBalanceResponse>
      <ndb:accountNumber>1234567890</ndb:accountNumber>
      <ndb:customerName>Aarav Sharma</ndb:customerName>
      <ndb:availableBalance>45230.75</ndb:availableBalance>
      <ndb:ledgerBalance>47230.75</ndb:ledgerBalance>
      <ndb:currency>INR</ndb:currency>
      <ndb:asOf>2026-09-28T16:08:03+05:30</ndb:asOf>
    </ndb:getBalanceResponse>
  </soap:Body>
</soap:Envelope>
```

Try it with curl (save the request above as `getBalance.xml`):

```bash
curl -X POST http://localhost:8000/soap \
  -H "Content-Type: text/xml; charset=utf-8" \
  -H 'SOAPAction: "http://bank.local/soap/corebanking/v1/getBalance"' \
  --data-binary @getBalance.xml
```

## getMiniStatement

```xml
<ndb:getMiniStatement>
  <ndb:accountNumber>1234567890</ndb:accountNumber>
  <ndb:maxEntries>5</ndb:maxEntries>          <!-- optional, default 10, max 100 -->
</ndb:getMiniStatement>
```

Response body:

```xml
<ndb:getMiniStatementResponse>
  <ndb:accountNumber>1234567890</ndb:accountNumber>
  <ndb:currency>INR</ndb:currency>
  <ndb:availableBalance>45230.75</ndb:availableBalance>
  <ndb:entryCount>5</ndb:entryCount>
  <ndb:entries>
    <ndb:entry>
      <ndb:transactionId>TXN1021</ndb:transactionId>
      <ndb:date>2026-09-27</ndb:date>
      <ndb:type>DEBIT</ndb:type>
      <ndb:amount>500.00</ndb:amount>
      <ndb:description>ATM WDL/ATM-MUM-0107</ndb:description>
      <ndb:balanceAfter>45230.75</ndb:balanceAfter>
    </ndb:entry>
    <!-- ... -->
  </ndb:entries>
</ndb:getMiniStatementResponse>
```

## transferFunds (simulated)

```xml
<ndb:transferFunds>
  <ndb:fromAccount>1234567890</ndb:fromAccount>
  <ndb:toAccount>9876543210</ndb:toAccount>
  <ndb:amount>500.00</ndb:amount>
  <ndb:currency>INR</ndb:currency>             <!-- optional, default INR -->
  <ndb:mode>INTERNAL</ndb:mode>                <!-- optional, default INTERNAL -->
  <ndb:remarks>ATM transfer</ndb:remarks>      <!-- optional -->
  <ndb:referenceId>174032551234</ndb:referenceId> <!-- optional RRN = idempotency key -->
</ndb:transferFunds>
```

Response body:

```xml
<ndb:transferFundsResponse>
  <ndb:transferId>TRX10004</ndb:transferId>
  <ndb:status>COMPLETED</ndb:status>
  <ndb:fromAccount>1234567890</ndb:fromAccount>
  <ndb:toAccount>9876543210</ndb:toAccount>
  <ndb:amount>250.00</ndb:amount>
  <ndb:currency>INR</ndb:currency>
  <ndb:mode>INTERNAL</ndb:mode>
  <ndb:availableBalance>44380.65</ndb:availableBalance>  <!-- sender's balance after the transfer -->
  <ndb:timestamp>2026-09-28T16:08:03+05:30</ndb:timestamp>
</ndb:transferFundsResponse>
```

`referenceId` plays the role of an ATM **retrieval reference number (RRN)**: if the switch times out and retries
with the same RRN, it receives the original result instead of a second debit — the SOAP equivalent of REST's
`Idempotency-Key`. The same `banking_service.transfer_funds()` handles both.

## SOAP Faults

SOAP 1.1 returns **every** fault with **HTTP 500**; the reason is inside the XML. (REST, by contrast, uses the
HTTP status code itself.)

```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ndb="http://bank.local/soap/corebanking/v1">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Client</faultcode>
      <faultstring>Available balance Rs 44380.65 is insufficient for a transfer of Rs 9000000.00.</faultstring>
      <detail>
        <ndb:BankingFault>
          <ndb:errorCode>INSUFFICIENT_FUNDS</ndb:errorCode>
          <ndb:errorMessage>Available balance Rs 44380.65 is insufficient for a transfer of Rs 9000000.00.</ndb:errorMessage>
          <ndb:requestId>4edcfead9c45</ndb:requestId>
        </ndb:BankingFault>
      </detail>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>
```

| faultcode | errorCode | Cause | REST equivalent |
|---|---|---|---|
| `soap:Client` | `ACCOUNT_NOT_FOUND` | unknown account | 404 |
| `soap:Client` | `BENEFICIARY_NOT_FOUND` | unknown `toAccount` | 422 |
| `soap:Client` | `INVALID_AMOUNT` | ≤ 0, non-numeric, > 2 decimals | 400 |
| `soap:Client` | `INSUFFICIENT_FUNDS` | balance too low | 422 |
| `soap:Client` | `ACCOUNT_INACTIVE` | dormant account | 409 |
| `soap:Client` | `INVALID_REQUEST` | missing element, bad `maxEntries` | 400 |
| `soap:Client` | `MALFORMED_XML` | not well-formed XML | 400 |
| `soap:Client` | `UNKNOWN_OPERATION` | body names an unsupported operation | 404 |
| `soap:Client` | `SOAPACTION_MISMATCH` | `SOAPAction` header ≠ body operation | 400 |
| `soap:VersionMismatch` | `VERSION_MISMATCH` | a SOAP 1.2 envelope was sent | – |
| `soap:Server` | `HOST_UNAVAILABLE` | `X-Demo-Simulate: 500/503/504` (simulated outage) | 5xx |

## Security notes

* The XML parser is hardened: no DTDs, no external entities, no network access (prevents XXE attacks) and a
  64 KB request limit. A test proves an XXE payload cannot read `/etc/passwd`.
* Real legacy SOAP deployments typically use **WS-Security** (signed/encrypted messages) and mutual TLS on a
  private network; the simulator identifies consumers only through the `ConsumerInfo` header.

## Calling the service from Python (zeep)

Because the service publishes a standard WSDL, SOAP tooling can generate a client automatically:

```python
from zeep import Client

client = Client("http://localhost:8000/soap?wsdl")
header = {"ConsumerInfo": {"channel": "BRANCH", "terminalId": "BR-MUM-0101"}}

balance = client.service.getBalance(accountNumber="1234567890", _soapheaders=header)
print(balance.availableBalance)            # Decimal('45230.75')

result = client.service.transferFunds(fromAccount="1234567890", toAccount="9876543210",
                                      amount="500.00", referenceId="RRN000000000001")
print(result.transferId, result.status)   # TRX10001 COMPLETED
```

The test-suite runs exactly this against a live server (`test_zeep_soap_client_interoperability`).
