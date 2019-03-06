#!/usr/bin/node
/*
 * fett 2019-2
*/
var local_port=0
var local_host='localhost'
var server_port=5670
var server_host='localhost'
var remote_port=0
var keep_conn_count=10
var conn_count=0
var runas_server=false
var net=require("net")

var log=function(){console.log("["+new Date().toLocaleString()+"]"+Array.prototype.join.call(arguments," "))}
var debug=e=>{}//log
var show=bf=>{return "["+bf.length+"]"+bf.toString()}

var argv=process.argv

// read config from file
try{
	var fs=require('fs')
	if(fs.existsSync("nagent.config")){
		text=fs.readFileSync('nagent.config',"utf8")
		eval(text)
	}
}catch(e){
	log("parse config file was failed!")
	log("append --help/-h for help")
	process.exit()
}

// parse command line
if(argv.length>2){
	let cur=2
	while(cur<argv.length){
		switch(argv[cur]){
			case "--help":
			case "-h":
				log("-p\t\t: need server open port.\n-h --help\t: this help.\n-P\t\t: local service port.")
				process.exit()
				break
			case "-p":
				remote_port=parseInt(argv[++cur])
				break
			case "-P":
				local_port=parseInt(argv[++cur])
				break
			case "-sp":
				server_port=parseInt(argv[++cur])
				break
			case "-s":
				runas_server=true
				++cur
				break
			default:cur++
		}
	}
}


if(!runas_server){// client chunk
if(local_port==0||remote_port==0){
	log("local port or server open port can't be 0, pls see help!")
	process.exit()
}

log("server open port:", remote_port)
log("local service port:", local_port)


// handling login
var handling_login=(sock,data)=>{
	if(data.toString()=="ok\r"){
		log("login is done.", sock.remoteAddress+":"+sock.remotePort)
		sock.on("data", d=>{handling_data(sock,d)})
	}else{
		log("login is failed.", sock.remoteAddress+":"+sock.remotePort, data.toString())
		sock.end()
	}
}

// handling data
var handling_data=(sock,data)=>{
	if(!sock.partner){
		if(!sock.buffer)// save data for connect done
			sock.buffer=data
		else{
			sock.buffer=Buffer.concat([sock.buffer,data])
			return
		}
		partner = net.connect(local_port, local_host)
		conn_count--
		partner.on("connect", e=>{
			log("partner connect is done. port is", local_port)
			debug("s>>", show(sock.buffer))
			partner.write(sock.buffer)
			sock.partner=partner
		})
		partner.on("data", d=>{debug("s<<",show(d));sock.write(d)})
		partner.on("error", e=>{open_conn()}) 
		partner.on("end",e=>{log("partner is closed", local_port);sock.end()})
	}else{
		debug("s>>", show(data))
		sock.partner.write(data)
	}
}

// open service
var open_conn=port=>{
	if(conn_count>=keep_conn_count)return
	var temp=net.connect(server_port, server_host)
	conn_count+=1
	temp.on("connect", e=>{
		log(temp.remoteAddress, temp.localPort, "connected! current connection count is", conn_count)
		temp.write("NAGENT1.0 guest nopwd "+remote_port+"\r")// protocal,username,password(can't include space char),open port
		temp.once("data", d=>{handling_login(temp,d)})
		if(conn_count<keep_conn_count)open_conn()
	})
	temp.on("error", e=>{conn_count--;log(e.errno);setTimeout(open_conn, 1000)})
	temp.on("end", e=>{
		conn_count--
		log("connection is closed", temp.remotePort, "connnection count:", conn_count)
		if(temp.partner)temp.partner.end()
		setTimeout(open_conn, 1000)
	})
}

open_conn()

}else{// server chunk
var ports={}// port=>server(clients)
var debug=e=>{}//console.warn

// connection was closed
var disconnect=(server,s)=>{
	if(s.client){
		server.conns.delete(s.client)
		s.client.destroy()
	}else if(s.partner){
		s.partner.destroy()
	}
	log("disconnect local port is:",server.localPort)
	if(server.conns.size+server.clients.length==0){
		log("server was stop port is ", server.localPort)
		server.close()
		ports[server.localPort]=undefined
	}
	log(s.remotePort+" was closed")
}

// open port
var open_port=(port,c)=>{
	c.on("error", e=>{log(e.errno, c.remotePort)})
	if(ports[port]){
		s=ports[port]
		c.on("end", e=>{disconnect(s,c)})
		s.clients.push(c)
		if(s.done)c.write("ok\r")
		return
	}
	log("open port...",port)
	var server=net.createServer()
	ports[port]=server
	server.done=false
	server.clients=[c]
	server.conns=new Set()// store used connection
	server.listen(port)
	c.on("end", e=>{disconnect(server,c)})
	server.on("connection", s=>{
		console.log("new connection at", s.remoteAddress+":"+s.remotePort+">>:"+s.localPort)
		if(server.clients.length==0){
			log(port+"'s client is null")
			s.end()
			return
		}
		s.client = server.clients.pop()
		s.client.partner = s
		server.conns.add(s.client)
		log("alloc",s.client.remoteAddress+":"+s.client.remotePort)
		s.client.on("data", d=>{
			debug(">>u",d.toString("hex"))
			try{s.write(d)}catch(e){}
		})
		s.on("data", d=>{debug(">>c",d.toString("hex"));s.client.write(d)})
		s.on("end", e=>{disconnect(server,s)})
		s.on("error", e=>{disconnect(server,s)})
	})
	server.on("error", e=>{
		log(e.errno)
		for(var cli of server.clients){
			cli.write("failed "+e.errno+"\r")
			cli.end()
		}
		ports[port]=undefined
	})
	server.on("listening", e=>{
		log("listen successful.",port)
		server.done=true
		for(var cli of server.clients){
			log("notify ok!", cli.remoteAddress, cli.remotePort)
			cli.write("ok\r")
		}
	})
}

var client_connect=c=>{
	c.on("data", d=>{
		try{
			s=d.toString()
			segs=s.slice(0,-1).split(" ")
			if(segs.length!=4 || segs[0]!="NAGENT1.0"){
				log("login failed",s)
				try{
				c.write("failed\r")
				c.end()
				}catch(e){}
				return
			}
		}catch(e){
			log("login exception:",e)
			c.write("except\r")
			c.end()
			return
		}
		log("login successful!",segs[1])
		c.removeAllListeners()
		open_port(parseInt(segs[3]), c)
	})
	c.on("error",e=>{c.end()})
	log("new client at", c.remoteAddress, c.remotePort)
}

var server=net.createServer(client_connect)
server.listen(server_port)
log("service listen at", server_port)

}// server chunk
