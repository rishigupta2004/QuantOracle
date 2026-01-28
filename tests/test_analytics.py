"""Test analytics calculations"""

import pandas as pd


class TestAnalytics:
    """Test portfolio analytics functions"""

    def test_portfolio_metrics(self, analytics, sample_holdings):
        """Test portfolio metrics calculation"""
        history = {
            "RELIANCE.NS": pd.DataFrame({"Close": [100 + i for i in range(100)]}),
            "TCS.NS": pd.DataFrame({"Close": [200 + i for i in range(100)]}),
            "AAPL": pd.DataFrame({"Close": [150 + i for i in range(100)]}),
        }
        result = analytics["portfolio_metrics"](sample_holdings, history)
        assert "dates" in result, "Should have dates"
        assert "values" in result, "Should have values"
        assert len(result["dates"]) > 0, "Should have data points"
        print(f"✓ Portfolio metrics: {len(result['dates'])} data points")

    def test_var_calculation(self, analytics, sample_holdings):
        """Test Value at Risk calculation"""
        history = {
            "RELIANCE.NS": pd.DataFrame({"Close": [100 + i for i in range(100)]})
        }
        result = analytics["var"](sample_holdings, history)
        assert "var_95" in result, "Should have VaR 95%"
        assert "var_99" in result, "Should have VaR 99%"
        assert result["var_95"] >= 0, "VaR should be non-negative"
        print(f"✓ VaR 95%: ₹{result['var_95']:,.0f}, VaR 99%: ₹{result['var_99']:,.0f}")

    def test_max_drawdown(self, analytics):
        """Test maximum drawdown calculation"""
        history = {
            "RELIANCE.NS": pd.DataFrame({"Close": [100, 90, 80, 70, 80, 90, 100, 110]})
        }
        result = analytics["max_drawdown"](history)
        assert result >= 0, "Drawdown should be non-negative"
        assert result <= 100, "Drawdown should be <= 100%"
        print(f"✓ Max Drawdown: {result:.2f}%")

    def test_beta_calculation(self, analytics, sample_holdings):
        """Test beta calculation"""
        history = {
            "RELIANCE.NS": pd.DataFrame({"Close": [100 + i for i in range(100)]}),
            "NIFTYBEES.NS": pd.DataFrame({"Close": [1000 + i * 2 for i in range(100)]}),
        }
        result = analytics["beta"](sample_holdings, history)
        assert "beta" in result, "Should have beta"
        assert "corr" in result, "Should have correlation"
        assert 0 <= result["corr"] <= 1, "Correlation should be 0-1"
        print(f"✓ Beta: {result['beta']:.2f}, Correlation: {result['corr']:.2f}")

    def test_var_with_different_confidence(self, analytics, sample_holdings):
        """Test VaR at different confidence levels"""
        history = {
            "RELIANCE.NS": pd.DataFrame({"Close": [100 + i for i in range(100)]})
        }
        var_95 = analytics["var"](sample_holdings, history, 0.95)
        var_99 = analytics["var"](sample_holdings, history, 0.99)
        assert "var_95" in var_95 and "var_99" in var_99, "Should have both VaR values"
        print(f"✓ VaR: 95% ₹{var_95['var_95']:,.0f} | 99% ₹{var_99['var_99']:,.0f}")


class TestAnalyticsEdgeCases:
    """Test edge cases in analytics"""

    def test_empty_holdings(self, analytics):
        """Test with empty holdings"""
        result = analytics["portfolio_metrics"]([], {})
        assert result["dates"] == [], "Should return empty dates"
        assert result["values"] == [], "Should return empty values"

    def test_empty_history(self, analytics, sample_holdings):
        """Test with empty history"""
        result = analytics["portfolio_metrics"](sample_holdings, {})
        assert result["dates"] == [], "Should return empty dates"

    def test_single_holding(self, analytics):
        """Test with single holding"""
        holdings = [{"symbol": "RELIANCE.NS", "quantity": 10, "avg_cost": 100}]
        history = {"RELIANCE.NS": pd.DataFrame({"Close": [100 + i for i in range(50)]})}
        result = analytics["portfolio_metrics"](holdings, history)
        assert len(result["dates"]) > 0, "Should have data"
        print(f"✓ Single holding metrics: {len(result['dates'])} points")
