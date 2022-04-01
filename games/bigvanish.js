// Import Pool for accessing the database.
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE,
  ssl: {
    rejectUnauthorized: false
  }
});


// Function to randomly timeout the user between 100-1,000,000 seconds.
async function bigVanish(id) {
    try {

        // Get value and construct response string.
        let rand = Math.floor(Math.random()*999000)+100;
        let str = `/timeout ${id} ${rand} BIG Vanish! Random timeout between 100 and 1,000,000 seconds. `;
        
        // Pull user from database.
        let client = await pool.connect();
        let res = await client.query(`SELECT * FROM bigvanish WHERE user_id = '${id}';`);
        let person = res.rows[0];
        
        if (!person) {

            // User is not in the database. Add them.
            person = { user_id: id, vanish: rand };
            await client.query(`INSERT INTO bigvanish(user_id, vanish)VALUES('${person.user_id}', ${person.vanish});`);

        } else {

            // Update database if new timeout is their highest.
            if (rand > person.vanish) {
                await client.query(`UPDATE bigvanish SET vanish = ${rand} WHERE user_id = '${id}';`);
                person.vanish = rand;
            } 
            
            if (rand < person.lowest) {
                await client.query(`UPDATE bigvanish SET lowest = ${rand} WHERE user_id = ${id};`);
                person.lowest = rand;
            }

        }
        
        // Release client.
        client.release();
    
        // Return response.
        return `${str}Your record high is ${person.vanish} seconds and low is ${person.lowest} seconds!`;

    } catch (err) {
        console.log(err);
        return;
    }
  }


  // Function to retrieve the leaderboard.
  async function bigVanishLb() {
    try {

        // Pull users from the database.
        let client = await pool.connect();
        let res = await client.query(`SELECT * FROM bigvanish ORDER BY vanish DESC LIMIT 3;`);
        let top = res.rows;
        client.release();
    
        // Format top users.
        let str = [];
        for (let i = 0; i < top.length; i++) {
            str.push(`${top[i].user_id}: ${top[i].vanish} seconds`);
        }

        // Return response.
        return `Big Vanish Leaderboard | ${str.length?str.join(' | '):'No users have played bigvanish yet'}`;
    } catch (err) {
        console.log(err);
        return;
    }
  }


// Function to retrieve the lowest timeouts.
async function bigVanishLow() {
    try {

        // Pull users from the database.
        let client = await pool.connect();
        let res = await client.query(`SELECT * FROM bigvanish ORDER BY lowest ASC LIMIT 3;`);
        let top = res.rows;
        client.release();
    
        // Format top users.
        let str = [];
        for (let i = 0; i < top.length; i++) {
            if (top[i].lowest === 1000000) continue;
            str.push(`${top[i].user_id}: ${top[i].lowest} seconds`);
        }

        // Return response.
        return `Big Vanish Lowest Leaderboard | ${str.length?str.join(' | '):'No users have played bigvanish yet'}`;
    } catch (err) {
        console.log(err);
        return;
    }
}


  export { bigVanish, bigVanishLb, bigVanishLow };