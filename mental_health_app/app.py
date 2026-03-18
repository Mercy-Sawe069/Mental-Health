from flask import Flask, request, jsonify, render_template
import pickle
import numpy as np
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)

# Use absolute paths so it works on PythonAnywhere
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE_DIR, 'mental_health_model.pkl'), 'rb') as f:
    model = pickle.load(f)
with open(os.path.join(BASE_DIR, 'scaler.pkl'), 'rb') as f:
    scaler = pickle.load(f)

MAPPINGS = {
    'Occupation': {'Corporate': 0, 'Student': 1, 'Business': 2, 'Housewife': 3},
    'family_history': {'No': 0, 'Yes': 1},
    'care_options': {'No': 0, 'Yes': 1, 'Not sure': 2},
    'Mental_Health_History': {'No': 0, 'Yes': 1},
    'Mood_Swings': {'Low': 0, 'Medium': 1, 'High': 2},
    'Days_Indoors': {
        '1-14 days': 0, '15-30 days': 1, '31-60 days': 2,
        'Go out Every day': 3, 'More than 2 months': 4
    },
    'Work_Interest': {'No': 0, 'Yes': 1, 'Maybe': 2},
    'Changes_Habits': {'No': 0, 'Yes': 1, 'Maybe': 2}
}

# In-memory session stats (resets on server restart)
assessment_stats = {'total': 0, 'at_risk': 0, 'low_risk': 0, 'indicator_counts': [0]*9}

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/stats')
def stats():
    total = assessment_stats['total']
    at_risk_pct = round((assessment_stats['at_risk'] / total * 100), 1) if total > 0 else 0
    low_risk_pct = round((assessment_stats['low_risk'] / total * 100), 1) if total > 0 else 0
    return jsonify({
        'total': total,
        'at_risk': assessment_stats['at_risk'],
        'low_risk': assessment_stats['low_risk'],
        'at_risk_pct': at_risk_pct,
        'low_risk_pct': low_risk_pct,
        'indicator_distribution': assessment_stats['indicator_counts']
    })

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()

        features = {
            'family_history': MAPPINGS['family_history'][data['family_history']],
            'Mental_Health_History': MAPPINGS['Mental_Health_History'][data['mental_health_history']],
            'Changes_Habits': MAPPINGS['Changes_Habits'][data['changes_habits']],
            'Mood_Swings': MAPPINGS['Mood_Swings'][data['mood_swings']],
            'Days_Indoors': MAPPINGS['Days_Indoors'][data['days_indoors']],
            'Work_Interest': MAPPINGS['Work_Interest'][data['work_interest']],
            'care_options': MAPPINGS['care_options'][data['care_options']],
            'Occupation': MAPPINGS['Occupation'][data['occupation']]
        }

        condition_indicators = [
            features['family_history'] == 1,
            features['Mental_Health_History'] == 1,
            features['Changes_Habits'] == 1,
            features['Mood_Swings'] >= 1,
            features['Days_Indoors'] >= 1,
            features['Work_Interest'] == 0,
            features['care_options'] in [0, 2],
            features['Occupation'] == 1
        ]

        indicator_count = sum(condition_indicators)
        has_challenge = int(indicator_count >= 4)
        risk_score = round((indicator_count / 8) * 100)

        # Determine risk level
        if risk_score < 30:
            risk_level = 'Low'
        elif risk_score < 60:
            risk_level = 'Moderate'
        else:
            risk_level = 'High'

        # Update stats
        assessment_stats['total'] += 1
        assessment_stats['indicator_counts'][indicator_count] += 1
        if has_challenge:
            assessment_stats['at_risk'] += 1
        else:
            assessment_stats['low_risk'] += 1

        # Build factor breakdown
        factor_labels = [
            'Family History', 'Mental Health History', 'Habit Changes',
            'Mood Swings', 'Days Indoors', 'Work Disinterest',
            'Limited Care Access', 'Student Status'
        ]
        active_factors = [factor_labels[i] for i, v in enumerate(condition_indicators) if v]

        recommendations = {
            'Low': 'Maintain your current healthy habits and stay connected with your support network.',
            'Moderate': 'Consider speaking with a counselor or trusted person. Monitor your wellbeing regularly.',
            'High': 'We strongly recommend consulting a mental health professional. You are not alone.'
        }

        return jsonify({
            'result': has_challenge,
            'risk_score': risk_score,
            'risk_level': risk_level,
            'indicator_count': indicator_count,
            'active_factors': active_factors,
            'summary': f'{indicator_count} of 8 risk indicators detected',
            'recommendation': recommendations[risk_level]
        })

    except KeyError as e:
        return jsonify({'error': f'Please complete all fields: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': 'Assessment unavailable. Please try again later.'}), 500

if __name__ == '__main__':
    app.run(debug=True)
