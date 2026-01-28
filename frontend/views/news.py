# HARD CODED IMPORTANT RULE: Keep code concise and meaningful
# - Remove unwanted/junky code and unnecessary lines
# - Each line must be valuable and to the point
# - Avoid bloated, illogical code - prefer 100 clean lines over 10000 junk lines
# - Author: Rishi Gupta
# - License: MIT

"""News - Market & Company news"""

import streamlit as st

from utils.news_service import (
    categorize_news,
    company_news,
    market_news,
    search_news,
    status,
)

# SET_PAGE_CONFIG_FIX_REMOVED


def _render_news_card(article: dict, key: int):
    """Render a single news article as a card"""
    headline = article.get("headline", "No Title")
    summary = article.get("summary", "")
    url = article.get("url", "#")
    source = article.get("source", "Unknown")
    datetime = article.get("datetime", "Recent")

    with st.container():
        st.markdown(
            f"""
            #### [{headline}]({url})
            """,
            unsafe_allow_html=True,
        )
        st.caption(f"{source} • {datetime}")
        st.write(summary)
        st.markdown("---")


def _generate_takeaway(article: dict) -> str:
    """Generate a key takeaway from the article"""
    headline = article.get("headline", "").strip()

    # Rule 1: If headline contains numbers (%, ₹, $), it's likely the news itself
    if any(char in headline for char in ["%", "₹", "$", "Rs", "USD", "INR"]):
        return headline

    # Rule 2: Prioritize earnings/results mentions
    lower_head = headline.lower()
    if any(
        w in lower_head
        for w in [
            "results",
            "earnings",
            "profit",
            "loss",
            "q1",
            "q2",
            "q3",
            "q4",
            "revenue",
        ]
    ):
        return headline

    # Fallback: Just return the headline as it's the most accurate summary
    return headline


def main():
    st.title("News")

    s = status()
    st.caption(
        f"Sources: NewsData.io {'✅' if s['newsdata'] else '❌'} | IndianAPI {'✅' if s['indianapi'] else '❌'}"
    )

    tab1, tab2, tab3 = st.tabs(["Market News", "Search News", "Company News"])

    with tab1:
        articles = market_news()
        if articles:
            categorized = categorize_news(articles)

            for category, cat_articles in categorized.items():
                if cat_articles:
                    with st.expander(
                        f"{category} ({len(cat_articles)})", expanded=True
                    ):
                        for i, article in enumerate(cat_articles):
                            st.markdown(
                                f"**Key Takeaway:** {_generate_takeaway(article)}"
                            )
                            _render_news_card(article, i)
        else:
            st.info("No news available right now. APIs are optional; RSS can also be blocked/rate-limited on some networks.")

    with tab2:
        col_search, col_spacer = st.columns([3, 1])
        with col_search:
            keyword = st.text_input(
                "Search news",
                placeholder="RELIANCE, crypto, earnings...",
                key="news_search_keyword",
                label_visibility="collapsed",
            )
        st.markdown("<br>", unsafe_allow_html=True)

        if keyword:
            results = search_news(keyword)
            if results:
                for i, n in enumerate(results[:15]):
                    st.markdown(f"**Key Takeaway:** {_generate_takeaway(n)}")
                    _render_news_card(n, i)
            else:
                st.info("No news found. Try a different keyword.")

    with tab3:
        col_sym, col_spacer = st.columns([3, 1])
        with col_sym:
            sym = st.text_input(
                "Symbol",
                placeholder="AAPL, MSFT, RELIANCE...",
                key="news_company_symbol",
                label_visibility="collapsed",
            )
        st.markdown("<br>", unsafe_allow_html=True)

        if sym:
            results = company_news(sym)
            if results:
                for i, n in enumerate(results[:10]):
                    st.markdown(f"**Key Takeaway:** {_generate_takeaway(n)}")
                    _render_news_card(n, i)
            else:
                st.info(f"No news found for {sym}. Try a different symbol.")


if __name__ == "__main__":
    main()
