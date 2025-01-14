import os
import json
from flask import Flask, render_template, send_from_directory

# Initialize the Flask app
app = Flask(__name__, static_folder='../frontend', template_folder='../frontend')

# Define the route for the home page
@app.route('/')
def index():
    # Load data from predictions.json
    data_path = os.path.join(os.path.dirname(__file__), 'data', 'predictions.json')
    try:
        with open(data_path, 'r') as file:
            data = json.load(file)
    except FileNotFoundError:
        return "Error: predictions.json not found."
    except json.JSONDecodeError:
        return "Error: Failed to parse predictions.json."
    
    # Render the index.html and pass predictions data
    return render_template('index.html', predictions=data)

# Serve static files like app.js and styles.css
@app.route('/<path:filename>')
def serve_static_file(filename):
    return send_from_directory(app.static_folder, filename)

# Run the app
if __name__ == '__main__':
    app.run(debug=True)
