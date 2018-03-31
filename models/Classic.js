var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Team = require('../models/Team');
var Game = require('../models/Game');

var classicSchema = new Schema({
	season: { type: Number, required: true, default: (new Date()).getFullYear() },
	user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
	team: { type: Number, ref: 'Team', required: true },
	picks: [{ type: Number, ref: 'Game', default: [] }],
	score: {
		potential: {
			best: { type: Number, required: function() {
				return this.record.wins < 4 && this.record.losses < 4;
			}, default: 16 },
			worst: { type: Number, required: function() {
				return this.record.wins < 4 && this.record.losses < 4;
			}, default: -8 },
		},
		final: { type: Number, required: function() {
			return this.record.wins == 4 || this.record.losses == 4;
		}}
	},
	record: {
		wins: { type: Number, required: true, default: 0, min: 0, max: 4 },
		losses: { type: Number, required: true, default: 0, min: 0, max: 4 }
	}
});

classicSchema.methods.isFinal = function() {
	return this.record.wins == 4 || this.record.losses == 4;
};

classicSchema.methods.pick = function(gameId) {
	if (this.picks.indexOf(gameId) > -1) {
		return;
	}

	this.picks.push(gameId);
};

classicSchema.methods.unpick = function(gameId) {
	if (this.picks.indexOf(gameId) == -1) {
		return;
	}

	this.picks.splice(this.picks.indexOf(gameId), 1);
};

classicSchema.methods.tally = function() {
	var classic = this;

	classic.record = { wins: 0, losses: 0 };

	classic.picks.forEach(function(pick) {
		if (!classic.isFinal()) {
			if (pick.isFinal()) {
				if ((pick.away.team == classic.team && pick.away.winner) || (pick.home.team == classic.team && pick.home.winner)) {
					classic.record.wins++;
				}
				else if ((pick.away.team == classic.team && !pick.away.winner) || (pick.home.team == classic.team && !pick.home.winner)) {
					classic.record.losses++;
				}
			}
		}
	});

	if (classic.record.wins == 4 || classic.record.losses == 4) {
		switch (classic.record.wins - classic.record.losses) {
			case 4:
				classic.score.final = 16;
				break;

			case 3:
				classic.score.final = 8;
				break;

			case 2:
				classic.score.final = 4;
				break;

			case 1:
				classic.score.final = 2;
				break;

			case -1:
				classic.score.final = -1;
				break;

			case -2:
				classic.score.final = -2;
				break;

			case -3:
				classic.score.final = -4;
				break;

			case -4:
				classic.score.final = -8;
				break;
		}
	}
	else {
		classic.score.potential = { best: 0, worst: 0 };
		classic.score.potential.best = Math.pow(2, 4 - classic.record.losses);
		classic.score.potential.worst = -1 * Math.pow(2, 3 - classic.record.wins);
	}
};

classicSchema.statics.initialize = function(user, season) {
	return new Promise(function(resolve, reject) {
		var dataPromises = [
			Team.find()
		];

		Promise.all(dataPromises).then(function(values) {
			var teams = values[0];

			var Classic = mongoose.model('Classic');
			var classicPromises = [];

			teams.forEach(function(team) {
				var classic = new Classic({ season: process.env.SEASON, user: user._id, team: team._id });

				classicPromises.push(classic.save());
			});

			Promise.all(classicPromises).then(function() {
				resolve('done');
			});
		});
	});
};

classicSchema.statics.standingsSort = function(a, b) {
	if (a.score.final > b.score.final) {
		return -1;
	}
	else if (b.score.final > a.score.final) {
		return 1;
	}
	else {
		if (a.score.potential.worst > b.score.potential.worst) {
			return -1;
		}
		else if (b.score.potential.worst > a.score.potential.worst) {
			return 1;
		}
		else {
			if (a.score.potential.best > b.score.potential.best) {
				return -1;
			}
			else if (b.score.potential.best > a.score.potential.best) {
				return 1;
			}
			else {
				if (a.user.displayName < b.user.displayName) {
					return -1;
				}
				else if (b.user.displayName < a.user.displayName) {
					return 1;
				}
				else {
					return 0;
				}
			}
		}
	}
};

classicSchema.statics.populatedPicksStartTimeSort = function(a, b) {
	if (a.startTime < b.startTime) {
		return -1;
	}
	else if (b.startTime < a.startTime) {
		return 1;
	}
	else {
		return 0;
	}
};

module.exports = mongoose.model('Classic', classicSchema);
