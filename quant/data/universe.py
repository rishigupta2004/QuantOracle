"""Trading universe definitions for Indian equities."""

from __future__ import annotations

NIFTY50_SYMBOLS = {
    "ADANIENT.NS": "Adani Enterprises",
    "ADANIPORTS.NS": "Adani Ports",
    "APOLLOHOSP.NS": "Apollo Hospitals",
    "ASIANPAINT.NS": "Asian Paints",
    "AXISBANK.NS": "Axis Bank",
    "BAJAJ-AUTO.NS": "Bajaj Auto",
    "BAJFINANCE.NS": "Bajaj Finance",
    "BAJAJFINSV.NS": "Bajaj Finserv",
    "BPCL.NS": "Bharat Petroleum",
    "BHARTIARTL.NS": "Bharti Airtel",
    "BRITANNIA.NS": "Britannia",
    "CIPLA.NS": "Cipla",
    "COALINDIA.NS": "Coal India",
    "DIVISLAB.NS": "Divi's Labs",
    "DRREDDY.NS": "Dr. Reddy's",
    "EICHERMOT.NS": "Eicher Motors",
    "GRASIM.NS": "Grasim",
    "HCLTECH.NS": "HCL Tech",
    "HDFCBANK.NS": "HDFC Bank",
    "HDFCLIFE.NS": "HDFC Life",
    "HEROMOTOCO.NS": "Hero MotoCorp",
    "HINDALCO.NS": "Hindalco",
    "HINDUNILVR.NS": "Hindustan Unilever",
    "ICICIBANK.NS": "ICICI Bank",
    "INDUSINDBK.NS": "IndusInd Bank",
    "INFY.NS": "Infosys",
    "ITC.NS": "ITC",
    "JSWSTEEL.NS": "JSW Steel",
    "KOTAKBANK.NS": "Kotak Bank",
    "LT.NS": "Larsen & Toubro",
    "LTIM.NS": "LTIMindtree",
    "M&M.NS": "M&M",
    "MARUTI.NS": "Maruti Suzuki",
    "NESTLEIND.NS": "Nestle India",
    "NTPC.NS": "NTPC",
    "ONGC.NS": "ONGC",
    "POWERGRID.NS": "Power Grid",
    "RELIANCE.NS": "Reliance Industries",
    "SBILIFE.NS": "SBI Life",
    "SBIN.NS": "SBI",
    "SUNPHARMA.NS": "Sun Pharma",
    "TATACONSUM.NS": "Tata Consumer",
    # "TATAMOTORS.NS": "Tata Motors",  # yfinance symbol broken
    "TATASTEEL.NS": "Tata Steel",
    "TCS.NS": "TCS",
    "TECHM.NS": "Tech Mahindra",
    "TITAN.NS": "Titan",
    "ULTRACEMCO.NS": "UltraTech Cement",
    "UPL.NS": "UPL",
    "WIPRO.NS": "Wipro",
}

ETF = {
    "NIFTYBEES.NS": "Nifty 50 ETF",
    "GOLDBEES.NS": "Gold ETF",
    "SP500.NS": "S&P 500 ETF",
    "MIDCAPBEES.NS": "Midcap ETF",
    "SMLCAPBEES.NS": "Smallcap ETF",
    "LIQUIDBEES.NS": "Liquid ETF",
    "TATASILV.NS": "Tata Silver ETF",
    "SILVERBEES.NS": "Silver ETF",
    "KOTAKGOLD.NS": "Kotak Gold ETF",
    "SBIETFGOLD.NS": "SBI Gold ETF",
    "MON100.NS": "Nasdaq 100 ETF",
    "MAFANG.NS": "MAFANG ETF",
    "JUNIORBEES.NS": "Nifty Next 50 ETF",
    "BANKBEES.NS": "Bank Nifty ETF",
    "ITBEES.NS": "Nifty IT ETF",
    "PHARMABEES.NS": "Nifty Pharma ETF",
    "PSUBANKBEES.NS": "PSU Bank ETF",
}

INDEX_PROXY = {
    "^NSEI": "NIFTYBEES.NS",
    "^NSEBANK": "BANKBEES.NS",
    "^CNXIT": "ITBEES.NS",
}

STOCK = {
    **{s: NIFTY50_SYMBOLS[s] for s in NIFTY50_SYMBOLS},
    "IEX.NS": "IEX",
    "CDSL.NS": "CDSL",
    "ZOMATO.NS": "Zomato",
    "PAYTM.NS": "Paytm",
    "JIOFIN.NS": "Jio Financial",
    "DMART.NS": "DMart",
    "HAL.NS": "HAL",
    "VBL.NS": "Varun Beverages",
    "BSE.NS": "BSE Ltd",
    "ANGELONE.NS": "Angel One",
    "IRFC.NS": "IRFC",
    "RVNL.NS": "RVNL",
    "IREDA.NS": "IREDA",
}


def all_symbols() -> dict[str, str]:
    """Return all known symbols."""
    return {**STOCK, **ETF}


def is_india_symbol(sym: str) -> bool:
    """Check if symbol is Indian (NSE/BSE)."""
    return (
        sym.endswith(".NS")
        or sym.endswith(".BO")
        or sym.startswith("^NSE")
        or sym.startswith("^BSE")
    )


def normalize_symbol(sym: str) -> str:
    """Normalize symbol to yfinance format."""
    sym = sym.strip().upper()
    if sym in INDEX_PROXY:
        return INDEX_PROXY[sym]
    if sym.endswith((".NS", ".BO")):
        return sym
    if sym in ETF or sym in STOCK:
        return f"{sym}.NS"
    for s in STOCK:
        if s.replace(".NS", "") == sym:
            return s
    for s in ETF:
        if s.replace(".NS", "") == sym:
            return s
    return sym


def search_symbols(query: str) -> list[dict]:
    """Search symbols by name or ticker."""
    if not query:
        return []
    query = query.lower()
    items = all_symbols()
    return [
        {
            "symbol": s,
            "name": n,
            "exchange": "NSE",
            "type": "ETF" if s in ETF else "STOCK",
            "region": "India",
        }
        for s, n in items.items()
        if query in s.lower() or query in n.lower()
    ][:20]
