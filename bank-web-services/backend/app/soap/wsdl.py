"""
WSDL 1.1 contract of the legacy SOAP service (served at ``GET /soap?wsdl``).

SOAP is *contract-first*: consumers such as an ATM switch generate their
client code from this document. Style: document/literal wrapped - each
operation has one request element and one ``...Response`` element.
"""

NDB_NS = "http://bank.local/soap/corebanking/v1"

WSDL_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<wsdl:definitions name="CoreBankingService"
    targetNamespace="http://bank.local/soap/corebanking/v1"
    xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"
    xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:tns="http://bank.local/soap/corebanking/v1">

  <wsdl:documentation>
    National Digital Bank - legacy Core Banking SOAP service used by ATM switches and branch software.
    EDUCATIONAL SIMULATOR - NOT A REAL BANKING SYSTEM. All data is fictional.
  </wsdl:documentation>

  <wsdl:types>
    <xsd:schema targetNamespace="http://bank.local/soap/corebanking/v1" elementFormDefault="qualified">

      <xsd:simpleType name="AccountNumber">
        <xsd:restriction base="xsd:string"><xsd:pattern value="[0-9]{6,18}"/></xsd:restriction>
      </xsd:simpleType>
      <xsd:simpleType name="Money">
        <xsd:restriction base="xsd:decimal"><xsd:fractionDigits value="2"/></xsd:restriction>
      </xsd:simpleType>
      <xsd:simpleType name="Channel">
        <xsd:restriction base="xsd:string">
          <xsd:enumeration value="ATM"/>
          <xsd:enumeration value="BRANCH"/>
        </xsd:restriction>
      </xsd:simpleType>

      <!-- SOAP header identifying the legacy consumer -->
      <xsd:element name="ConsumerInfo">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="channel" type="tns:Channel"/>
          <xsd:element name="terminalId" type="xsd:string" minOccurs="0"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>

      <!-- getBalance -->
      <xsd:element name="getBalance">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="accountNumber" type="tns:AccountNumber"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="getBalanceResponse">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="accountNumber" type="tns:AccountNumber"/>
          <xsd:element name="customerName" type="xsd:string"/>
          <xsd:element name="availableBalance" type="tns:Money"/>
          <xsd:element name="ledgerBalance" type="tns:Money"/>
          <xsd:element name="currency" type="xsd:string"/>
          <xsd:element name="asOf" type="xsd:dateTime"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>

      <!-- getMiniStatement -->
      <xsd:complexType name="StatementEntry"><xsd:sequence>
        <xsd:element name="transactionId" type="xsd:string"/>
        <xsd:element name="date" type="xsd:date"/>
        <xsd:element name="type" type="xsd:string"/>
        <xsd:element name="amount" type="tns:Money"/>
        <xsd:element name="description" type="xsd:string"/>
        <xsd:element name="balanceAfter" type="tns:Money"/>
      </xsd:sequence></xsd:complexType>
      <xsd:element name="getMiniStatement">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="accountNumber" type="tns:AccountNumber"/>
          <xsd:element name="maxEntries" type="xsd:int" minOccurs="0"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="getMiniStatementResponse">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="accountNumber" type="tns:AccountNumber"/>
          <xsd:element name="currency" type="xsd:string"/>
          <xsd:element name="availableBalance" type="tns:Money"/>
          <xsd:element name="entryCount" type="xsd:int"/>
          <xsd:element name="entries">
            <xsd:complexType><xsd:sequence>
              <xsd:element name="entry" type="tns:StatementEntry" minOccurs="0" maxOccurs="unbounded"/>
            </xsd:sequence></xsd:complexType>
          </xsd:element>
        </xsd:sequence></xsd:complexType>
      </xsd:element>

      <!-- transferFunds -->
      <xsd:element name="transferFunds">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="fromAccount" type="tns:AccountNumber"/>
          <xsd:element name="toAccount" type="tns:AccountNumber"/>
          <xsd:element name="amount" type="tns:Money"/>
          <xsd:element name="currency" type="xsd:string" minOccurs="0"/>
          <xsd:element name="mode" type="xsd:string" minOccurs="0"/>
          <xsd:element name="remarks" type="xsd:string" minOccurs="0"/>
          <xsd:element name="referenceId" type="xsd:string" minOccurs="0"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="transferFundsResponse">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="transferId" type="xsd:string"/>
          <xsd:element name="status" type="xsd:string"/>
          <xsd:element name="fromAccount" type="tns:AccountNumber"/>
          <xsd:element name="toAccount" type="tns:AccountNumber"/>
          <xsd:element name="amount" type="tns:Money"/>
          <xsd:element name="currency" type="xsd:string"/>
          <xsd:element name="mode" type="xsd:string"/>
          <xsd:element name="availableBalance" type="tns:Money"/>
          <xsd:element name="timestamp" type="xsd:dateTime"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>

      <!-- Fault detail -->
      <xsd:element name="BankingFault">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="errorCode" type="xsd:string"/>
          <xsd:element name="errorMessage" type="xsd:string"/>
          <xsd:element name="requestId" type="xsd:string" minOccurs="0"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </wsdl:types>

  <wsdl:message name="ConsumerInfoHeader"><wsdl:part name="ConsumerInfo" element="tns:ConsumerInfo"/></wsdl:message>
  <wsdl:message name="BankingFaultMessage"><wsdl:part name="fault" element="tns:BankingFault"/></wsdl:message>
  <wsdl:message name="getBalanceRequest"><wsdl:part name="parameters" element="tns:getBalance"/></wsdl:message>
  <wsdl:message name="getBalanceResponse"><wsdl:part name="parameters" element="tns:getBalanceResponse"/></wsdl:message>
  <wsdl:message name="getMiniStatementRequest"><wsdl:part name="parameters" element="tns:getMiniStatement"/></wsdl:message>
  <wsdl:message name="getMiniStatementResponse"><wsdl:part name="parameters" element="tns:getMiniStatementResponse"/></wsdl:message>
  <wsdl:message name="transferFundsRequest"><wsdl:part name="parameters" element="tns:transferFunds"/></wsdl:message>
  <wsdl:message name="transferFundsResponse"><wsdl:part name="parameters" element="tns:transferFundsResponse"/></wsdl:message>

  <wsdl:portType name="CoreBankingPortType">
    <wsdl:operation name="getBalance">
      <wsdl:input message="tns:getBalanceRequest"/>
      <wsdl:output message="tns:getBalanceResponse"/>
      <wsdl:fault name="BankingFault" message="tns:BankingFaultMessage"/>
    </wsdl:operation>
    <wsdl:operation name="getMiniStatement">
      <wsdl:input message="tns:getMiniStatementRequest"/>
      <wsdl:output message="tns:getMiniStatementResponse"/>
      <wsdl:fault name="BankingFault" message="tns:BankingFaultMessage"/>
    </wsdl:operation>
    <wsdl:operation name="transferFunds">
      <wsdl:input message="tns:transferFundsRequest"/>
      <wsdl:output message="tns:transferFundsResponse"/>
      <wsdl:fault name="BankingFault" message="tns:BankingFaultMessage"/>
    </wsdl:operation>
  </wsdl:portType>

  <wsdl:binding name="CoreBankingSoapBinding" type="tns:CoreBankingPortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <wsdl:operation name="getBalance">
      <soap:operation soapAction="http://bank.local/soap/corebanking/v1/getBalance"/>
      <wsdl:input>
        <soap:header message="tns:ConsumerInfoHeader" part="ConsumerInfo" use="literal"/>
        <soap:body use="literal"/>
      </wsdl:input>
      <wsdl:output><soap:body use="literal"/></wsdl:output>
      <wsdl:fault name="BankingFault"><soap:fault name="BankingFault" use="literal"/></wsdl:fault>
    </wsdl:operation>
    <wsdl:operation name="getMiniStatement">
      <soap:operation soapAction="http://bank.local/soap/corebanking/v1/getMiniStatement"/>
      <wsdl:input>
        <soap:header message="tns:ConsumerInfoHeader" part="ConsumerInfo" use="literal"/>
        <soap:body use="literal"/>
      </wsdl:input>
      <wsdl:output><soap:body use="literal"/></wsdl:output>
      <wsdl:fault name="BankingFault"><soap:fault name="BankingFault" use="literal"/></wsdl:fault>
    </wsdl:operation>
    <wsdl:operation name="transferFunds">
      <soap:operation soapAction="http://bank.local/soap/corebanking/v1/transferFunds"/>
      <wsdl:input>
        <soap:header message="tns:ConsumerInfoHeader" part="ConsumerInfo" use="literal"/>
        <soap:body use="literal"/>
      </wsdl:input>
      <wsdl:output><soap:body use="literal"/></wsdl:output>
      <wsdl:fault name="BankingFault"><soap:fault name="BankingFault" use="literal"/></wsdl:fault>
    </wsdl:operation>
  </wsdl:binding>

  <wsdl:service name="CoreBankingService">
    <wsdl:documentation>Simulated legacy core banking service (demo data only).</wsdl:documentation>
    <wsdl:port name="CoreBankingPort" binding="tns:CoreBankingSoapBinding">
      <soap:address location="{address}"/>
    </wsdl:port>
  </wsdl:service>
</wsdl:definitions>
"""


def render_wsdl(address: str) -> str:
    return WSDL_TEMPLATE.replace("{address}", address)
