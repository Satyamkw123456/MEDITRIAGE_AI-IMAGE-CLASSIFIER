import pytest
from hypothesis import given, settings, HealthCheck, strategies as st
from app.services.geriatric.composer import Level, Vote, Decision, compose


# Hypothesis strategies for generating Level, Vote, and forbidden sets
levels_strategy = st.sampled_from(list(Level))
rationale_strategy = st.text(min_size=1, max_size=50)
source_strategy = st.text(min_size=1, max_size=20)

vote_strategy = st.builds(
    Vote,
    source=source_strategy,
    level=levels_strategy,
    rationale=rationale_strategy
)

votes_list_strategy = st.lists(vote_strategy, min_size=1, max_size=10)
forbidden_set_strategy = st.sets(levels_strategy, max_size=4)


@settings(suppress_health_check=[HealthCheck.too_slow], deadline=None)
@given(votes=votes_list_strategy, forbidden=forbidden_set_strategy)
def test_property_composer_never_lowers_level(votes, forbidden):
    """
    Core Invariant: For ANY combination of input votes and forbidden sets,
    the composed level is NEVER lower than the maximum input vote's level.
    """
    decision = compose(votes, forbidden)
    max_input_level = max(v.level for v in votes)

    assert decision.level >= max_input_level, (
        f"VIOLATION: Composed level {decision.level} is lower than max input vote {max_input_level}"
    )


@given(votes=votes_list_strategy, forbidden=forbidden_set_strategy)
def test_property_composer_forbidden_handling(votes, forbidden):
    """
    Property: If the final level is in the forbidden set, it MUST be Level.EMERGENCY
    (because Emergency is the ceiling and cannot be pushed further up).
    Otherwise, the resulting level must NOT be in the forbidden set.
    """
    decision = compose(votes, forbidden)
    if decision.level in forbidden:
        assert decision.level == Level.EMERGENCY, (
            f"Level {decision.level} is in forbidden set {forbidden} but did not reach ceiling EMERGENCY"
        )


@given(votes=votes_list_strategy)
def test_property_composer_without_forbidden(votes):
    """
    Property: With an empty forbidden set, the final level is EXACTLY the maximum input vote.
    """
    decision = compose(votes, set())
    max_input_level = max(v.level for v in votes)
    assert decision.level == max_input_level


def test_composer_empty_votes_default():
    """
    Property: Empty votes falls back safely to SELF_CARE without crashing.
    """
    decision = compose([])
    assert decision.level == Level.SELF_CARE
    assert len(decision.votes) == 1
    assert decision.votes[0].source == "DEFAULT_BASELINE"
