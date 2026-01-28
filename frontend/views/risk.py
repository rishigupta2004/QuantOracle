"""Risk - VaR, Max Drawdown, Beta"""

# HARD CODED IMPORTANT RULE: Keep code concise and meaningful
# - Remove unwanted/junky code and unnecessary lines
# - Each line must be valuable and to the point
# - Avoid bloated, illogical code - prefer 100 clean lines over 10000 junk lines
# - Author: Rishi Gupta
# - License: MIT

import streamlit as st
import pandas as pd

from services.market_data import get_historical
from utils.analytics import beta, max_drawdown, var
from utils.api import holdings

SAMPLE_PORTFOLIO = [
    {"symbol": "RELIANCE.NS", "quantity": 50, "avg_cost": 2400},
    {"symbol": "TCS.NS", "quantity": 25, "avg_cost": 3800},
    {"symbol": "HDFCBANK.NS", "quantity": 100, "avg_cost": 1600},
    {"symbol": "INFY.NS", "quantity": 40, "avg_cost": 1400},
    {"symbol": "SBIN.NS", "quantity": 200, "avg_cost": 550},
]


def _explain_metric(name, value, explanation):
    """Display a metric with its explanation"""
    col1, col2 = st.columns([1, 2])
    with col1:
        st.metric(name, value)
    with col2:
        st.info(explanation)


def main():
    st.title("📊 Risk Dashboard")

    user_holdings = holdings()
    holdings_to_use = user_holdings if user_holdings else SAMPLE_PORTFOLIO
    is_sample = not bool(user_holdings)

    if is_sample:
        st.info(
            "📌 **Demo Mode**: Using sample portfolio. Add positions in the Portfolio page to analyze your own portfolio."
        )

    syms = [x["symbol"] for x in holdings_to_use]

    with st.spinner("Calculating risk metrics..."):
        history = {}
        for s in syms:
            h = get_historical(s, "1y")
            if not h.empty:
                history[s] = h

        if not history:
            st.error("❌ Insufficient data to calculate risk metrics")
            return

        v = var(holdings_to_use, history)
        dd = max_drawdown(history)
        b = beta(holdings_to_use, history)

        # Compute totals explicitly (keeps analytics contract small and stable).
        total_cost = sum(p["quantity"] * p["avg_cost"] for p in holdings_to_use)
        total_value = 0.0
        for p in holdings_to_use:
            h = history.get(p["symbol"])
            if h is None or h.empty:
                continue
            total_value += float(h["Close"].iloc[-1]) * float(p["quantity"])
        returns = ((total_value - total_cost) / total_cost * 100) if total_cost else 0.0

    # Risk metrics section
    st.subheader("📈 Portfolio Summary")

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.metric("Total Value", f"₹{total_value:,.0f}")
    with c2:
        st.metric("Total Cost", f"₹{total_cost:,.0f}")
    with c3:
        st.metric("Returns", f"{returns:+.1f}%")
    with c4:
        st.metric("Positions", len(holdings_to_use))

    st.markdown("---")

    # Risk metrics with explanations
    st.subheader("⚠️ Risk Metrics")

    c_var, c_dd, c_beta, c_corr = st.columns(4)

    with c_var:
        st.metric("VaR 95%", f"₹{v.get('var_95', 0):,.0f}", delta_color="inverse")
        st.caption("Maximum expected loss at 95% confidence")

    with c_dd:
        st.metric("Max Drawdown", f"{dd:.1f}%", delta_color="inverse")
        st.caption("Largest peak-to-trough decline")

    with c_beta:
        st.metric("Portfolio Beta", f"{b.get('beta', 1.0):.2f}")
        st.caption(
            f"Market sensitivity: {'High' if b.get('beta', 1) > 1.2 else 'Medium' if b.get('beta', 1) > 0.8 else 'Low'}"
        )

    with c_corr:
        st.metric("Market Correlation", f"{b.get('corr', 0):.2f}")
        st.caption("Correlation with NIFTY 50")

    # Detailed explanations
    with st.expander("📖 Understanding Risk Metrics", expanded=True):
        st.markdown(
            """
        ### Value at Risk (VaR)
        **VaR 95%** = ₹{:,.0f}
        
        This means that **95% of the time**, your portfolio loss will not exceed ₹{:,.0f} on any given day.
        
        **Example:** If VaR is ₹50,000, there's a 95% chance you won't lose more than ₹50,000 in a single day.

        ---

        ### Maximum Drawdown
        **Max Drawdown** = {:.1f}%
        
        This is the **largest peak-to-trough decline** your portfolio experienced in the past year.

        **Example:** A 15% max drawdown means your portfolio dropped 15% from its highest value at some point.

        ---

        ### Beta
        **Portfolio Beta** = {:.2f}
        
        - **Beta > 1**: Portfolio is **more volatile** than the market (more risk, more reward)
        - **Beta = 1**: Portfolio moves **in line** with the market
        - **Beta < 1**: Portfolio is **less volatile** than the market (less risk, less reward)

        ---

        ### Correlation
        **Market Correlation** = {:.2f}
        
        - **0.7 to 1.0**: Strong positive correlation (moves with market)
        - **0.3 to 0.7**: Moderate correlation
        - **-0.3 to 0.3**: Low/no correlation
        - **Below -0.3**: Negative correlation (moves opposite to market)
        """.format(
                v.get("var_95", 0),
                v.get("var_95", 0),
                dd,
                b.get("beta", 1.0),
                b.get("corr", 0),
            )
        )

    # Holdings breakdown
    st.markdown("---")
    st.subheader("📋 Holdings Breakdown")

    if holdings_to_use:
        for pos in holdings_to_use:
            h = history.get(pos["symbol"], pd.DataFrame())
            current_price = h["Close"].iloc[-1] if not h.empty else 0
            market_value = current_price * pos["quantity"]
            cost_basis = pos["quantity"] * pos["avg_cost"]
            pnl = market_value - cost_basis
            pnl_pct = (pnl / cost_basis) * 100 if cost_basis > 0 else 0

            c_sym, c_qty, c_cost, c_value, c_pnl = st.columns([2, 1, 1, 1, 1])
            with c_sym:
                st.markdown(f"**{pos['symbol']}**")
            with c_qty:
                st.write(f"{pos['quantity']}")
            with c_cost:
                st.write(f"₹{pos['avg_cost']:,.0f}")
            with c_value:
                st.write(f"₹{market_value:,.0f}")
            with c_pnl:
                st.write(f"{pnl:+.0f} ({pnl_pct:+.1f}%)")

    # Risk suggestions
    st.markdown("---")
    st.subheader("💡 Risk Management Suggestions")

    risk_level = (
        "High"
        if dd > 20 or b.get("beta", 1) > 1.3
        else "Medium"
        if dd > 10 or b.get("beta", 1) > 1
        else "Low"
    )

    if risk_level == "High":
        st.warning("⚠️ Your portfolio has **High Risk**. Consider:")
        st.markdown("- Diversifying across more sectors")
        st.markdown("- Reducing exposure to high-beta stocks")
        st.markdown("- Adding defensive stocks (FMCG, Pharma)")
    elif risk_level == "Medium":
        st.info("ℹ️ Your portfolio has **Medium Risk**.")
        st.markdown("- Consider your investment horizon")
        st.markdown("- Review sector concentration")
    else:
        st.success("✅ Your portfolio has **Low Risk**.")
        st.markdown("- Well diversified")
        st.markdown("- Consider if returns meet your goals")


if __name__ == "__main__":
    main()
