
import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    from pipeline.ai_client import call_ai_client
    print("Successfully imported call_ai_client")
except ImportError as e:
    print(f"Error importing call_ai_client: {e}")
    sys.exit(1)

try:
    # Mocking config/env if needed, but let's try to run it and see if it fails on config first.
    # If it fails on config, we might need to mock it.
    print("Calling call_ai_client...")
    # We expect this to fail if HF_API_KEY is not set, or return a string if it works.
    # We are just checking the return type signature if possible, or simulating.
    
    # Since we don't want to actually call the API and waste tokens or fail on auth if not set in this env,
    # we can inspect the code or just try to run it if the user has env vars set.
    # The user said "fail the ai client", so maybe they want us to debug it.
    
    # Let's just print the function object to be sure
    print(call_ai_client)
    
except Exception as e:
    print(f"Error: {e}")
