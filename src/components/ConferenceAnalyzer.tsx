'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Table, Loader2 } from 'lucide-react';

// Data service to fetch data from the live API
const DataService = {
  async fetchData() {
    try {
      const response = await fetch('https://api.collegefootballdata.com/games?year=2024', {
        headers: {
          Authorization: `Bearer wQFpYo4FojSBRPm4nM7kLpCaqS1tykHwPrWgy2yUDhbDPf5EapDBnO5tXTTIUltv`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data from API');
      }

      const gamesData = await response.json();

      // Transform API data to match frontend expectations
      return gamesData.map((game) => ({
        'Conference Game': game.conference_game,
        'Home Conference': game.home_conference,
        'Away Conference': game.away_conference,
        'Home Team': game.home_team,
        'Away Team': game.away_team,
        'Home Points': game.home_points,
        'Away Points': game.away_points,
        'Start Date': game.start_date,
        'Completed': game.completed,
      }));
    } catch (error) {
      console.error('Error fetching data from API:', error);
      throw error;
    }
  },
};

const ConferenceAnalyzer = () => {
  const [data, setData] = useState([]);
  const [conferences, setConferences] = useState([]);
  const [selectedConference, setSelectedConference] = useState('');
  const [rankings, setRankings] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const gameData = await DataService.fetchData();
        setData(gameData);

        // Extract unique conferences
        const uniqueConferences = [
          ...new Set(
            gameData
              .filter((game) => game['Conference Game'] && game['Home Conference'])
              .map((game) => game['Home Conference'])
          ),
        ];
        setConferences(uniqueConferences);
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Error loading data: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const analyzeConferenceData = (games, conferenceName) => {
    const conferenceGames = games.filter(
      (game) =>
        game['Conference Game'] === true &&
        game['Home Conference'] === conferenceName &&
        game['Completed'] === true
    );

    const conferenceTeams = [
      ...new Set([
        ...conferenceGames.map((game) => game['Home Team']),
        ...conferenceGames.map((game) => game['Away Team']),
      ]),
    ];

    const teamStats = {};
    conferenceTeams.forEach((team) => {
      teamStats[team] = {
        wins: 0,
        defeated: new Set(),
        games: [],
      };
    });

    conferenceGames.forEach((game) => {
      const winner =
        game['Home Points'] > game['Away Points']
          ? game['Home Team']
          : game['Away Team'];
      const loser =
        game['Home Points'] > game['Away Points']
          ? game['Away Team']
          : game['Home Team'];

      teamStats[winner].wins += 1;
      teamStats[winner].defeated.add(loser);
      teamStats[winner].games.push({
        opponent: loser,
        score: `${game['Home Points']}-${game['Away Points']}`,
        date: game['Start Date'],
      });
    });

    const weightedCredits = {};
    Object.entries(teamStats).forEach(([team, stats]) => {
      const directCredits = 2 * stats.wins;

      const secondLevelWins = Array.from(stats.defeated).reduce(
        (sum, opponent) => sum + teamStats[opponent]?.wins || 0,
        0
      );
      const secondLevelCredit = 0.5 * secondLevelWins;

      const thirdLevelWins = Array.from(stats.defeated).reduce((sum, opponent) => {
        return (
          sum +
          Array.from(teamStats[opponent]?.defeated || []).reduce(
            (innerSum, secondOpponent) => innerSum + teamStats[secondOpponent]?.wins || 0,
            0
          )
        );
      }, 0);
      const thirdLevelCredit = 0.25 * thirdLevelWins;

      weightedCredits[team] = {
        team,
        directCredits,
        secondLevelCredit,
        thirdLevelCredit,
        totalCredit: directCredits + secondLevelCredit + thirdLevelCredit,
        details: {
          wins: stats.wins,
          defeated: Array.from(stats.defeated),
          games: stats.games,
        },
      };
    });

    const values = Object.values(weightedCredits);
    const maxCredit = Math.max(...values.map((w) => w.totalCredit));
    const minCredit = Math.min(...values.map((w) => w.totalCredit));

    return Object.values(weightedCredits)
      .map((credit) => ({
        ...credit,
        dominanceRanking:
          maxCredit === minCredit
            ? 100
            : (100 * (credit.totalCredit - minCredit)) / (maxCredit - minCredit),
      }))
      .sort((a, b) => b.dominanceRanking - a.dominanceRanking);
  };

  const handleConferenceChange = (e) => {
    const conf = e.target.value;
    setSelectedConference(conf);
    setLoading(true);

    if (conf) {
      try {
        const rankings = analyzeConferenceData(data, conf);
        setRankings(rankings);
      } catch (err) {
        setError('Error analyzing data: ' + err.message);
        setRankings([]);
      }
    } else {
      setRankings([]);
    }

    setLoading(false);
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Conference Dominance Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <select
            value={selectedConference}
            onChange={handleConferenceChange}
            className="w-full p-2 border rounded"
            disabled={loading}
          >
            <option value="">Select Conference</option>
            {conferences.map((conf) => (
              <option key={conf} value={conf}>
                {conf}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="animate-spin h-8 w-8" />
          </div>
        )}

        {error && (
          <div className="text-red-500 p-4 border border-red-300 rounded mb-4">
            {error}
          </div>
        )}

        {!loading && !error && rankings.length > 0 && (
          <>
            <div className="h-96 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rankings}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="team"
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    dataKey="dominanceRanking"
                    fill="#8884d8"
                    name="Dominance Ranking"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="mb-4 p-2 bg-blue-500 text-white rounded flex items-center gap-2"
            >
              <Table size={16} />
              {showDetails ? 'Hide' : 'Show'} Detailed Breakdown
            </button>

            {showDetails && (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left">Team</th>
                      <th className="border p-2 text-left">Direct Wins (2pts)</th>
                      <th className="border p-2 text-left">2nd Level (0.5pts)</th>
                      <th className="border p-2 text-left">3rd Level (0.25pts)</th>
                      <th className="border p-2 text-left">Total Score</th>
                      <