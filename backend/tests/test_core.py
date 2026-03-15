from __future__ import annotations

import os
import tempfile
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def build_client():
    temp_db = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
    temp_db.close()
    os.environ['DATABASE_PATH'] = temp_db.name
    os.environ['APP_ACCESS_CODE'] = 'test-code'
    os.environ['SESSION_SECRET'] = 'test-secret'
    os.environ['LLM_PROVIDER'] = 'mock'

    from fintech_app.app import create_app

    app = create_app()
    app.config['TESTING'] = True
    return app.test_client()


def auth(client):
    r = client.post('/auth/login', json={'code': 'test-code'})
    assert r.status_code == 200


def test_seeded_archetypes_and_scenarios():
    client = build_client()
    auth(client)
    a = client.get('/archetypes')
    s = client.get('/scenarios')
    assert a.status_code == 200 and len(a.get_json()) >= 8
    assert s.status_code == 200 and len(s.get_json()) >= 12


def test_simulation_and_run_duplicate():
    client = build_client()
    auth(client)

    archetypes = client.get('/archetypes').get_json()
    mix = {a['id']: 0 for a in archetypes}
    mix[archetypes[0]['id']] = 100

    payload = {
        'scenario_name': 'unit-test',
        'num_agents': 80,
        'num_steps': 6,
        'seed': 11,
        'monte_carlo_runs': 2,
        'archetype_mix': mix,
        'country_context': {
            'inflation_expectation': 'high', 'usd_volatility': 'high', 'country_risk_pressure': 'high', 'bank_trust_index': 'medium',
            'social_panic_level': 'medium', 'liquidity_preference_shift': 'high', 'crypto_volatility': 'high', 'energy_cost_pressure': 'high',
            'consumer_confidence': 'low', 'policy_uncertainty': 'high', 'labor_market_stress': 'medium', 'political_noise': 'high'
        },
        'company_context': {
            'wallet_yield_current': 'medium', 'wallet_yield_new': 'medium', 'competitor_yield': 'high', 'cashback_percent': 'medium',
            'cashback_cap': 'medium', 'onboarding_friction': 'low', 'KYC_friction': 'medium', 'app_stability': 'medium', 'transfer_limits': 'medium',
            'withdrawal_delay_risk': 'medium', 'support_quality': 'medium', 'trust_baseline': 'medium', 'credit_offer_aggressiveness': 'medium', 'loan_rate_level': 'high'
        }
    }

    r = client.post('/simulate', json=payload)
    assert r.status_code == 200
    run = r.get_json()
    assert run['outputs']['single_run']['timeline']
    assert 'monte_carlo' in run['outputs']
    single = run['outputs']['single_run']
    assert 'panic_index_score' in single
    assert 0 <= single['panic_index_score'] <= 100
    assert single['panic_index_label'] in {'Normal', 'Alert', 'Stressed', 'Panic'}
    assert 'panic_index_components' in single
    assert 'panic_index_main_driver' in single

    d = client.post(f"/runs/{run['id']}/duplicate")
    assert d.status_code == 200
    assert d.get_json()['id'] != run['id']


def test_translation_and_recommendation_fallbacks():
    client = build_client()
    auth(client)

    ts = client.post('/translate-scenario', json={'text': 'Cambio de gobierno con incertidumbre'})
    assert ts.status_code == 200
    assert 'country_context' in ts.get_json()

    it = client.post('/impact-translate', json={'text': 'There is a war in the Middle East'})
    assert it.status_code == 200
    assert 'transmission_channels' in it.get_json()

    rec_payload = {
        'simulation_results': {'dummy': True},
        'country_context': {'inflation_expectation': 'high', 'usd_volatility': 'high', 'country_risk_pressure': 'high', 'bank_trust_index': 'medium',
            'social_panic_level': 'medium', 'liquidity_preference_shift': 'high', 'crypto_volatility': 'high', 'energy_cost_pressure': 'high',
            'consumer_confidence': 'low', 'policy_uncertainty': 'high', 'labor_market_stress': 'medium', 'political_noise': 'high'},
        'company_context': {'wallet_yield_current': 'medium', 'wallet_yield_new': 'medium', 'competitor_yield': 'high', 'cashback_percent': 'medium',
            'cashback_cap': 'medium', 'onboarding_friction': 'low', 'KYC_friction': 'medium', 'app_stability': 'medium', 'transfer_limits': 'medium',
            'withdrawal_delay_risk': 'medium', 'support_quality': 'medium', 'trust_baseline': 'medium', 'credit_offer_aggressiveness': 'medium', 'loan_rate_level': 'high'},
        'scenario_metadata': {'name': 'x'}
    }
    st = client.post('/strategy-recommend', json=rec_payload)
    inv = client.post('/innovation-recommend', json=rec_payload)
    assert st.status_code == 200 and 'tactical_actions' in st.get_json()
    assert inv.status_code == 200 and 'innovation_lab' in inv.get_json()
    assert len(st.get_json().get('tactical_actions', [])) >= 10
    assert len(inv.get_json().get('innovation_lab', [])) >= 10

    ctx_review = client.post(
        '/contexts/review',
        json={
            'context_profile': {
                'id': 'ctx_1',
                'title': 'Stress Context',
                'description': 'test',
                'country_context': {
                    'inflation_expectation': 'high', 'usd_volatility': 'high', 'country_risk_pressure': 'high', 'bank_trust_index': 'medium',
                    'social_panic_level': 'medium', 'liquidity_preference_shift': 'high', 'crypto_volatility': 'high', 'energy_cost_pressure': 'high',
                    'consumer_confidence': 'low', 'policy_uncertainty': 'high', 'labor_market_stress': 'medium', 'political_noise': 'high'
                },
            }
        },
    )
    assert ctx_review.status_code == 200
    assert 'country_context' in ctx_review.get_json()

    scn_review = client.post(
        '/scenarios/review',
        json={
            'scenario': {
                'id': 's1',
                'name': 'Scenario A',
                'description': 'desc',
                'default_country_context': {
                    'inflation_expectation': 'high', 'usd_volatility': 'high', 'country_risk_pressure': 'high', 'bank_trust_index': 'medium',
                    'social_panic_level': 'medium', 'liquidity_preference_shift': 'high', 'crypto_volatility': 'high', 'energy_cost_pressure': 'high',
                    'consumer_confidence': 'low', 'policy_uncertainty': 'high', 'labor_market_stress': 'medium', 'political_noise': 'high'
                },
                'default_company_context': {
                    'wallet_yield_current': 'medium', 'wallet_yield_new': 'medium', 'competitor_yield': 'high', 'cashback_percent': 'medium',
                    'cashback_cap': 'medium', 'onboarding_friction': 'low', 'KYC_friction': 'medium', 'app_stability': 'medium', 'transfer_limits': 'medium',
                    'withdrawal_delay_risk': 'medium', 'support_quality': 'medium', 'trust_baseline': 'medium', 'credit_offer_aggressiveness': 'medium', 'loan_rate_level': 'high'
                },
                'notes': 'n',
            }
        },
    )
    assert scn_review.status_code == 200
    assert 'default_company_context' in scn_review.get_json()

    scn_generate = client.post(
        '/scenarios/generate',
        json={'text': 'Lanzar un producto de ahorro dolarizado con retiro inmediato', 'lang': 'es'},
    )
    assert scn_generate.status_code == 200
    generated = scn_generate.get_json()
    assert generated.get('name')
    assert 'default_country_context' in generated
    assert 'default_company_context' in generated


def test_pdf_report_generation():
    client = build_client()
    auth(client)
    archetypes = client.get('/archetypes').get_json()
    mix = {a['id']: 0 for a in archetypes}
    mix[archetypes[0]['id']] = 100
    payload = {
        'scenario_name': 'pdf-test',
        'num_agents': 40,
        'num_steps': 4,
        'seed': 7,
        'monte_carlo_runs': 1,
        'report_language': 'es',
        'archetype_mix': mix,
        'country_context': {
            'inflation_expectation': 'high', 'usd_volatility': 'high', 'country_risk_pressure': 'high', 'bank_trust_index': 'medium',
            'social_panic_level': 'medium', 'liquidity_preference_shift': 'high', 'crypto_volatility': 'high', 'energy_cost_pressure': 'high',
            'consumer_confidence': 'low', 'policy_uncertainty': 'high', 'labor_market_stress': 'medium', 'political_noise': 'high'
        },
        'company_context': {
            'wallet_yield_current': 'medium', 'wallet_yield_new': 'medium', 'competitor_yield': 'high', 'cashback_percent': 'medium',
            'cashback_cap': 'medium', 'onboarding_friction': 'low', 'KYC_friction': 'medium', 'app_stability': 'medium', 'transfer_limits': 'medium',
            'withdrawal_delay_risk': 'medium', 'support_quality': 'medium', 'trust_baseline': 'medium', 'credit_offer_aggressiveness': 'medium', 'loan_rate_level': 'high'
        }
    }
    run = client.post('/simulate', json=payload).get_json()
    r = client.get(f"/runs/{run['id']}/report-pdf?lang=es")
    assert r.status_code == 200
    assert r.headers.get('Content-Type') == 'application/pdf'
    assert len(r.data) > 1000


def test_access_gate_blocks_without_login():
    client = build_client()
    assert client.get('/health').status_code == 200
    assert client.get('/archetypes').status_code == 401
