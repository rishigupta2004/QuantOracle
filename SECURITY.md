# Security Notes

## Secrets

- Do **not** commit `.env` or `.streamlit/secrets.toml`.
- Use `.env.example` as a template.
- For Streamlit Cloud, configure secrets in the Streamlit app settings (environment variables / secrets UI).

If any keys were ever committed or shared, rotate them.

