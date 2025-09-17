import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface ChampionData {
    name: string;
    percentage: number;
}

const TopThreeChart = () => {
    const [topThree, setTopThree] = useState<ChampionData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const championDocRef = doc(db, 'publicData', 'weeklyChampion');

        const unsubscribe = onSnapshot(championDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.topFive && Array.isArray(data.topFive)) {
                    setTopThree(data.topFive.slice(0, 3));
                }
            } else {
                console.log("Champion document does not exist!");
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching champion data:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const chartOptions = {
        indexAxis: 'y' as const,
        responsive: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (_) => ""
                }
            }
        },
        scales: {
            x: {
                min: 0,
                max: 100,
                ticks: { color: '#9CA3AF', callback: (value) => `${value}%` },
                grid: { color: '#4B5563' },
            },
            y: {
                ticks: { color: '#EEE', font: { size: 14, weight: 'bold' as const } },
                grid: { display: false },
            }
        }
    };

    const chartData = {
        labels: topThree.map(p => p.name),
        datasets: [{
            label: '',
            backgroundColor: ['#FFD700', '#C0C0C0', '#CD7F32'],
            borderColor: ['#FBBF24', '#D1D5DB', '#D97706'],
            borderWidth: 1,
            data: topThree.map(p => p.percentage),
        }],
    };

    const sortedTopThreeForDisplay = [...topThree];
    // if (sortedTopThreeForDisplay.length === 3) {
    //     [sortedTopThreeForDisplay[0], sortedTopThreeForDisplay[1]] = [sortedTopThreeForDisplay[1], sortedTopThreeForDisplay[0]];
    // }

    const displayChartData = {
        labels: sortedTopThreeForDisplay.map(p => p.name),
        datasets: [{ ...chartData.datasets[0], data: sortedTopThreeForDisplay.map(p => p.percentage) }]
    };

    if (loading) return <div className="h-64 bg-gray-800 rounded-lg animate-pulse"></div>;
    if (topThree.length === 0) return null;

    return (
        <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-xl font-bold mb-4 text-center text-yellow-300">本週排行榜</h3>
            <Bar options={chartOptions} data={displayChartData} />
        </div>
    );
};

export default TopThreeChart;