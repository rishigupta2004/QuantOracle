"""Portfolio - Holdings management"""

# HARD CODED IMPORTANT RULE: Keep code concise and meaningful
# - Remove unwanted/junky code and unnecessary lines
# - Each line must be valuable and to the point
# - Avoid bloated, illogical code - prefer 100 clean lines over 10000 junk lines
# - Author: Rishi Gupta
# - License: MIT

import streamlit as st

from services.market_data import get_quotes
from utils.api import holdings, add_holding, remove_holding

# SET_PAGE_CONFIG_FIX_REMOVED


def _display_holdings():
    h = holdings()
    if not h:
        st.info("No holdings. Add some positions below.")
        return
    syms = [x["symbol"] for x in h]

    with st.spinner("Loading quotes..."):
        quotes = get_quotes(syms)

    total, cost = 0, 0
    for i, pos in enumerate(h):
        q = quotes.get(pos["symbol"], {})
        price = q.get("price", 0)
        source = q.get("source", "Real-time")
        val = price * pos["quantity"]
        gain = (
            (val - pos["quantity"] * pos["avg_cost"])
            / (pos["quantity"] * pos["avg_cost"])
            * 100
            if pos["quantity"] * pos["avg_cost"] > 0
            else 0
        )
        total += val
        cost += pos["quantity"] * pos["avg_cost"]
        c1, c2, c3, c4, c5 = st.columns([2, 1, 1, 1, 1])
        c1.markdown(f"**{pos['symbol']}**")
        if price > 0:
            label = f"₹{price:,.2f}"
            if source == "Historical":
                label += " (Last Close)"
            c2.markdown(label)
            c3.markdown(f"{pos['quantity']}")
            c4.markdown(f"{gain:+.1f}%")
        else:
            c2.markdown("⚠️ N/A")
            c3.markdown(f"{pos['quantity']}")
            c4.markdown("⚠️ No data")
        if c5.button("×", key=f"del_{i}"):
            remove_holding(i)
            st.rerun()

    st.markdown("---")
    cr = (total - cost) / cost * 100 if cost > 0 else 0
    c1, c2, c3 = st.columns(3)
    c1.metric("Total Value", f"₹{total:,.0f}")
    c2.metric("Total Cost", f"₹{cost:,.0f}")
    if total > 0 and cost > 0:
        c3.metric("Return", f"{cr:+.1f}%")
    else:
        c3.metric("Return", "⚠️ N/A")


def main():
    st.title("Portfolio")
    _display_holdings()

    st.markdown("### Add Position")
    c1, c2, c3 = st.columns(3)
    sym = c1.text_input("Symbol", placeholder="RELIANCE.NS")
    qty = c2.number_input("Quantity", min_value=0.01, value=10.0)
    cost = c3.number_input("Avg Cost", min_value=0.0, value=1000.0)

    if st.button("Add Position"):
        if sym:
            add_holding(sym, qty, cost)
            st.success(f"Added {qty} x {sym} @ ₹{cost}")
            st.rerun()

    st.markdown("---")
    st.subheader("Smart Rebalance")

    h = holdings()
    if h and len(h) >= 2:
        syms = [x["symbol"] for x in h]
        quotes = get_quotes(syms)

        total_value = 0
        positions = []
        for pos in h:
            q = quotes.get(pos["symbol"], {})
            price = q.get("price", 0)
            if price > 0:
                value = price * pos["quantity"]
                total_value += value
                positions.append(
                    {
                        "symbol": pos["symbol"],
                        "quantity": pos["quantity"],
                        "price": price,
                        "current_value": value,
                        "avg_cost": pos["avg_cost"],
                    }
                )

        if total_value > 0:
            target_each = total_value / len(positions)

            st.markdown("### Action Table")
            c1, c2, c3, c4, c5 = st.columns([2, 1.5, 1.5, 1.5, 1.5])
            c1.markdown("**Symbol**")
            c2.markdown("**Current %**")
            c3.markdown("**Target %**")
            c4.markdown("**Action**")
            c5.markdown("**Amount**")

            actions = []
            for p in positions:
                current_pct = (p["current_value"] / total_value) * 100
                target_pct = 100 / len(positions)
                diff = target_each - p["current_value"]
                action = "HOLD"
                if diff > 0:
                    action = f"BUY ₹{diff:,.0f}"
                elif diff < 0:
                    action = f"SELL ₹{abs(diff):,.0f}"

                actions.append(
                    {
                        "symbol": p["symbol"],
                        "current_pct": current_pct,
                        "target_pct": target_pct,
                        "action": action,
                        "amount": diff,
                    }
                )

                c1.markdown(f"**{p['symbol']}**")
                c2.markdown(f"{current_pct:.1f}%")
                c3.markdown(f"{target_pct:.1f}%")
                c4.markdown(action)
                c5.markdown(f"₹{diff:+,.0f}" if diff != 0 else "—")

            with st.expander("Rebalance Summary"):
                st.write(f"**Total Portfolio Value:** ₹{total_value:,.0f}")
                st.write(f"**Number of Positions:** {len(positions)}")
                st.write(f"**Target per Position:** ₹{target_each:,.0f}")
    else:
        st.info("Add at least 2 positions to use Smart Rebalance")


if __name__ == "__main__":
    main()
