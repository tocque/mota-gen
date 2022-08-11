
function rand(n: number) {
	return Math.trunc(Math.random() * n);
}

interface GenOptions {
	width: number;
	height: number;
	mapCount: number;
}

function gen(options: GenOptions) {

	const {
		width = 13,
		height = 13,
		mapCount = 10,
	} = options;

	let a = [];
	let v = [];
	let cnt = 169,
		times = 0;
	let tot = 0;
	
	function vaild(i: number, j: number, k: number) {
		if (Math.min(i, j) >= k && Math.max(i, j) <= 12 - k && (Math.min(i, j) == k || Math.max(i, j) == 12 - k)) return 1;
		return 0;
	}
	
	function dfs(i, j) {
		if (a[i][j] == 1 || v[i][j] == times) return;
		tot++;
		v[i][j] = times;
		if (i) dfs(i - 1, j);
		if (i < 12) dfs(i + 1, j);
		if (j) dfs(i, j - 1);
		if (j < 12) dfs(i, j + 1);
	}
	
	function dfs2(i, j) {
		if (a[i][j]) return;
		if (rand(100) < 40) a[i][j] = 3;
		else a[i][j] = 4;
		tot += (a[i][j] == 3);
		if (i > 1) dfs2(i - 1, j);
		if (i < 11) dfs2(i + 1, j);
		if (j > 1) dfs2(i, j - 1);
		if (j < 11) dfs2(i, j + 1);
	}
	for (let i = 0; i <= 12; i++) {
		a[i] = [];
		v[i] = [];
		for (let j = 0; j <= 12; j++) a[i][j] = 0, v[i][j] = 0;
	}
	for (let t = 0; t <= 6; t++) {
		for (let i = 0; i <= 12; i++)
			for (let j = 0; j <= 12; j++)
				if (vaild(i, j, t)) {
					if (t == 0) a[i][j] = 1;
					else {
						if (a[i - 1][j - 1] && a[i - 1][j] + a[i][j - 1] != 1) continue;
						if (a[i - 1][j + 1] && a[i - 1][j] + a[i][j + 1] != 1) continue;
						if (a[i + 1][j - 1] && a[i + 1][j] + a[i][j - 1] != 1) continue;
						if (a[i + 1][j + 1] && a[i + 1][j] + a[i][j + 1] != 1) continue;
						if (rand(100) < 75) a[i][j] = 1;
	
					}
					cnt -= a[i][j];
					if (t) {
						tot = 0;
						++times;
						dfs(1, 1);
						//console.log(cnt, tot, times);
						if (tot != cnt) a[i][j] = 0, cnt++;
					}
					//console.log(i, j, a[i][j]);
				}
	}
	for (let i = 1; i <= 11; i++)
		for (let j = 1; j <= 11; j++)
			if (!a[i][j]) {
				let s = [a[i - 1][j - 1], a[i - 1][j], a[i - 1][j + 1], a[i][j + 1], a[i + 1][j + 1], a[i + 1][j], a[i + 1][j - 1], a[i][j - 1], a[i - 1][j - 1]],
					st = 0;
				for (let t = 1; t <= 8; t++)
					if ((s[t] != 1) ^ (s[t - 1] != 1)) st++;
				if (st <= 2) continue;
	
				for (let xi = 1; xi <= 11; xi++)
					for (let xj = 1; xj <= 11; xj++) v[xi][xj] = -1;
				let Q = [],
					start = 0,
					end = 2,
					res = 9;
				Q[0] = i;
				Q[1] = j;
				v[i][j] = 0;
				while (start < end) {
					let x = Q[start++],
						y = Q[start++];
					if (a[x][y] == 2) {
						res = v[x][y];
						break;
					}
					if (x > 1 && a[x - 1][y] != 1 && v[x - 1][y] < 0) Q[end++] = x - 1, Q[end++] = y, v[x - 1][y] = v[x][y] + 1;
					if (x < 11 && a[x + 1][y] != 1 && v[x + 1][y] < 0) Q[end++] = x + 1, Q[end++] = y, v[x + 1][y] = v[x][y] + 1;
					if (y > 1 && a[x][y - 1] != 1 && v[x][y - 1] < 0) Q[end++] = x, Q[end++] = y - 1, v[x][y - 1] = v[x][y] + 1;
					if (y < 11 && a[x][y + 1] != 1 && v[x][y + 1] < 0) Q[end++] = x, Q[end++] = y + 1, v[x][y + 1] = v[x][y] + 1;
				}
				let prob = 0;
				if (res >= 4) prob = 100;
				if (res == 3) prob = 70;
				if (res == 2) prob = 40;
				if (rand(100) < prob) a[i][j] = 2;
			}
	for (let i = 1; i <= 11; i++)
		for (let j = 1; j <= 11; j++)
			if (!a[i][j]) {
				tot = 0;
				dfs2(i, j);
				if (!tot) a[i][j] = 3;
			}
	console.log(a);
	let g2 = [207, 208, 209, 210, 211, 212];
	let g3 = ["redGem", "blueGem", "greenGem", "redPotion", "bluePotion", "yellowPotion"];
	for (let i = 0; i <= 12; i++)
		for (let j = 0; j <= 12; j++) {
			if (a[i][j] == 1) core.setBlock("yellowWall", i, j, "MT0");
			if (a[i][j] == 2) core.setBlock(g2[rand(6)], i, j, "MT0");
			if (a[i][j] == 3) core.setBlock(g3[rand(6)], i, j, "MT0");
		}
}