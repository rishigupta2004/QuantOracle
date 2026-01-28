# HARD CODED IMPORTANT RULE: Keep code concise and meaningful
# - Remove unwanted/junky code and unnecessary lines
# - Each line must be valuable and to the point
# - Avoid bloated, illogical code - prefer 100 clean lines over 10000 junk lines
# - Author: Rishi Gupta
# - License: MIT

THEME = {
    "base": "dark",
    "primaryColor": "#22C55E",
    "secondaryColor": "#3B82F6",
    "accentColor": "#A855F7",
    "backgroundColor": "#000000",
    "secondaryBackgroundColor": "#161616",
    "textColor": "#FAFAFA",
    "font": "Inter,sans-serif",
    "custom_css": """<style>
    /* Pure Black Background */
    .stApp {
        background-color: #000000;
        color: #FAFAFA;
    }
    
    /* Sidebar */
    section[data-testid="stSidebar"] {
        background-color: #0A0A0A;
        border-right: 1px solid #262626;
    }
    
    /* Metrics */
    [data-testid="stMetricValue"] {
        color: #FAFAFA !important;
        font-weight: 600;
    }
    [data-testid="stMetricLabel"] {
        color: #A3A3A3 !important;
    }
    [data-testid="stMetricDelta"] {
        /* Let Streamlit handle positive (green) vs negative (red) deltas. */
        font-weight: 600;
    }
    
    /* Headings */
    h1, h2, h3, h4, h5, h6 {
        color: #FAFAFA !important;
        font-weight: 600;
    }
    
    /* Links */
    a {
        color: #60A5FA !important;
    }
    a:hover {
        color: #93C5FD !important;
    }
    
    /* Buttons */
    .stButton > button {
        background-color: #22C55E;
        color: #000000;
        border: none;
        border-radius: 6px;
        font-weight: 500;
    }
    .stButton > button:hover {
        background-color: #16A34A;
    }
    
    /* Inputs */
    .stTextInput > div > div > input,
    .stNumberInput > div > div > input,
    .stTextArea > div > div > textarea,
    .stDateInput > div > div > input {
        background-color: #171717;
        color: #FAFAFA;
        border: 1px solid #404040;
        border-radius: 6px;
    }
    .stTextInput > div > div > input:focus,
    .stNumberInput > div > div > input:focus {
        border-color: #22C55E;
        box-shadow: 0 0 0 1px #22C55E;
    }
    
    /* Tabs */
    .stTabs [data-baseweb="tab-list"] {
        background-color: #171717;
        border-radius: 8px;
        padding: 4px;
        gap: 4px;
    }
    .stTabs [data-baseweb="tab"] {
        color: #A3A3A3;
        border-radius: 6px;
    }
    .stTabs [data-baseweb="tab"]:hover {
        background-color: #262626;
        color: #FAFAFA;
    }
    .stTabs [aria-selected="true"] {
        background-color: #262626 !important;
        color: #FAFAFA !important;
    }
    
    /* DataFrames */
    .stDataFrame {
        background-color: #171717;
        border-radius: 8px;
        border: 1px solid #262626;
    }
    
    /* Progress bar */
    .stProgress > div > div {
        background-color: #22C55E;
    }
    
    /* Success/Error/Warning/Info */
    .stSuccess {
        background-color: #166534;
        color: #FAFAFA;
        border-radius: 6px;
    }
    .stError {
        background-color: #991B1B;
        color: #FAFAFA;
        border-radius: 6px;
    }
    .stWarning {
        background-color: #854D0E;
        color: #FAFAFA;
        border-radius: 6px;
    }
    .stInfo {
        background-color: #1E40AF;
        color: #FAFAFA;
        border-radius: 6px;
    }
    
    /* Code blocks */
    code, pre {
        background-color: #171717 !important;
        color: #FAFAFA !important;
        border-radius: 6px;
    }
    
    /* Dividers */
    hr {
        border-color: #262626;
    }
    
    /* Select boxes */
    .stSelectbox > div > div {
        background-color: #171717;
        color: #FAFAFA;
        border: 1px solid #404040;
    }
    
    /* Spinner */
    .stSpinner {
        color: #22C55E;
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    ::-webkit-scrollbar-track {
        background: #171717;
    }
    ::-webkit-scrollbar-thumb {
        background: #404040;
        border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
        background: #525252;
    }
    
    /* Positive/Negative colors */
    .positive {
        color: #22C55E !important;
    }
    .negative {
        color: #EF4444 !important;
    }
    
    /* Cards */
    .custom-card {
        background-color: #171717;
        border: 1px solid #262626;
        border-radius: 8px;
        padding: 16px;
        margin: 8px 0;
    }
    
    /* Expander */
    .streamlit-expanderHeader {
        background-color: #171717;
        color: #FAFAFA;
        border-radius: 6px;
    }
    
    /* Tooltip */
    [data-tooltip] {
        color: #FAFAFA;
    }
    
    /* Plotly chart background */
    .js-plotly-plot .plotly .main-svg {
        background: transparent !important;
    }
</style>""",
}


def apply_theme():
    import streamlit as st

    st.set_page_config(
        page_title="QuantOracle",
        page_icon="📈",
        layout="wide",
        initial_sidebar_state="expanded",
    )
    st.markdown(f"<style>{THEME['custom_css']}</style>", unsafe_allow_html=True)


COLORS = {
    "background": "#000000",
    "card_background": "#171717",
    "sidebar_background": "#0A0A0A",
    "border_color": "#262626",
    "text_primary": "#FAFAFA",
    "text_secondary": "#A3A3A3",
    "accent_blue": "#60A5FA",
    "accent_green": "#22C55E",
    "accent_red": "#EF4444",
    "accent_purple": "#A855F7",
}


def format_currency(v, c="₹"):
    if v >= 1e7:
        return f"{c}{v / 1e7:.2f}Cr"
    if v >= 1e5:
        return f"{c}{v / 1e5:.2f}L"
    if v >= 1e3:
        return f"{c}{v / 1e3:.1f}K"
    return f"{c}{v:,.2f}"


def format_percentage(v):
    return f"{'+' if v > 0 else ''}{v:.2f}%"


def get_change_color(v):
    return "positive" if v > 0 else "negative" if v < 0 else "neutral"
